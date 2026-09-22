<script lang="ts">
	import type { AgentSessionSummary } from '@gizmo/protocol';
	import {
		createVirtualizer,
		observeElementRect,
	} from '@tanstack/svelte-virtual';
	import { onDestroy, tick } from 'svelte';
	import { get } from 'svelte/store';
	import type { AgentStore } from '../../agent-client';
	import { ScrollPanel } from '../../components';
	import type { PiExtensionUiStore } from '../extension-ui/PiExtensionUiStore.svelte';
	import {
		bottomTolerance,
		isAtBottom,
		observeFollow,
		scrollIntoEnd,
	} from './follow';
	import { dayKey, formatDay, turnToolCount } from './message-groups';
	import { createMessageRows, estimateRowHeight } from './message-rows';
	import JumpToLatest from './JumpToLatest.svelte';
	import MessageGroupView from './MessageGroup.svelte';
	import { createRowMeasurer } from './row-measure';
	import { streamingActivity } from './streaming';
	import ThreadEvent from './ThreadEvent.svelte';
	import UnreadMarker from './UnreadMarker.svelte';
	import { createTranscriptSettle } from './transcript-settle';
	import { countUnread, firstUnread, rowIndexOf } from './unread';

	interface Props {
		store: AgentStore;
		extensionUi?: PiExtensionUiStore;
		agentName: string;
		currentSession?: AgentSessionSummary;
		autoFollowOutput: boolean;
		/** Whether reasoning blocks start expanded. */
		expandReasoning: boolean;
		collapseToken?: number;
		matched?: ReadonlySet<string>;
		reveal?: (id: string) => Promise<void>;
	}

	let {
		store,
		extensionUi,
		agentName,
		currentSession,
		autoFollowOutput,
		expandReasoning,
		collapseToken,
		matched,
		reveal = $bindable(),
	}: Props = $props();

	let followOutput = $state(false);
	let viewport = $state<HTMLElement | null>(null);
	let knownCount = 0;
	let knownSession: string | undefined;
	let rowKeys: Array<string | number> = [];
	let rowEstimates: number[] = [];
	/**
	 * Bumped whenever a mounted row changes size: the virtualizer's store only
	 * notifies when the visible range moves, so rows below a growing one kept
	 * stale offsets until the next scroll. Reading it forces the re-render.
	 */
	let measureVersion = $state(0);

	let activity = $derived(
		streamingActivity(
			store.messages,
			store.sessionState,
			extensionUi?.workingFor(store.sessionId),
		),
	);
	// Queued steering and a compaction in progress are rows at the end of the
	// thread, so what is pending is visible where the user is already looking.
	let rows = $derived(
		createMessageRows(store.messages, {
			steering: store.queue?.steering ?? [],
			followUp: store.queue?.followUp ?? [],
			compacting: Boolean(store.compacting),
		}),
	);
	const initialViewport = { width: 800, height: 800 };
	const virtualizer = createVirtualizer<HTMLElement, HTMLDivElement>({
		count: 0,
		getScrollElement: () => viewport,
		getItemKey: (index) => rowKeys[index] ?? index,
		estimateSize: (index) => rowEstimates[index] ?? 220,
		overscan: 2,
		scrollEndThreshold: bottomTolerance,
		initialRect: initialViewport,
		observeElementRect: (instance, notify) =>
			observeElementRect(instance, (rect) =>
				notify(rect.height > 0 ? rect : initialViewport),
			),
	});
	let virtualItems = $derived.by(() => {
		void measureVersion;
		return $virtualizer.getVirtualItems();
	});
	let totalSize = $derived.by(() => {
		void measureVersion;
		return $virtualizer.getTotalSize();
	});
	const settle = createTranscriptSettle({
		viewport: () => viewport,
		totalSize: () => get(virtualizer).getTotalSize(),
		count: () => rows.length,
		scrollToEnd: () => get(virtualizer).scrollToEnd(),
		onSettled: (node) => (followOutput = isAtBottom(node)),
	});
	let lastMessageId = $derived(store.messages.at(-1)?.id);

	// The newest message in view while following; anything after it is unread
	// once the user scrolls up. Streaming appends to the same id, so a growing
	// reply does not count as new.
	let seenMessageId = $state<string>();
	let unreadCount = $derived(
		followOutput ? 0 : countUnread(store.messages, seenMessageId),
	);
	$effect(() => {
		if (followOutput) seenMessageId = lastMessageId;
	});
	/** The first message after the last one read, where the "New" rule sits. */
	let firstUnreadId = $derived(
		unreadCount ? firstUnread(store.messages, seenMessageId)?.id : undefined,
	);

	/** While following, every change in size re-pins the end. */
	function pinIfFollowing() {
		if (followOutput && autoFollowOutput) get(virtualizer).scrollToEnd();
	}

	$effect(() => {
		const count = rows.length;
		rowKeys = rows.map((row) => row.id);
		rowEstimates = rows.map(estimateRowHeight);
		const shouldFollow = autoFollowOutput && followOutput;
		get(virtualizer).setOptions({
			count,
			getItemKey: (index) => rowKeys[index] ?? index,
			// End anchoring follows measured growth without issuing a competing
			// scroll command for every streamed token.
			anchorTo: shouldFollow ? 'end' : 'start',
			followOnAppend: shouldFollow,
		});
		// The virtualizer only follows appends it saw from within its own
		// tolerance; a row that grew past it first is left behind. Re-pin once
		// the DOM has the new content.
		if (shouldFollow) void tick().then(pinIfFollowing);
	});

	onDestroy(settle.cancel);

	// A thread opens at its newest message, not wherever the previous one sat.
	$effect(() => {
		const sessionId = store.sessionId;
		const count = rows.length;
		if (!viewport || !count || sessionId === knownSession) return;
		knownSession = sessionId;
		followOutput = true;
		$virtualizer.measure();
		$virtualizer.scrollToEnd();
		settle.pin();
	});

	$effect(() => {
		const node = viewport;
		get(virtualizer).setOptions({ getScrollElement: () => node });
		if (!node) return;
		followOutput = isAtBottom(node);
		// Reaching the bottom always re-engages following; only the user
		// scrolling away releases it. Programmatic scrolls in between (a smooth
		// jump, the virtualizer keeping up with a growing reply) leave it alone.
		return observeFollow(node, (atBottom, byUser) => {
			if (atBottom) followOutput = true;
			else if (byUser) {
				settle.cancel();
				followOutput = false;
			}
		});
	});

	// Sending re-engages following even if the user had scrolled up to read.
	$effect(() => {
		const count = store.messages.length;
		if (count > knownCount && store.messages.at(-1)?.role === 'user') {
			followOutput = autoFollowOutput;
			if (autoFollowOutput) {
				void tick().then(() => $virtualizer.scrollToEnd());
			}
		}
		knownCount = count;
	});

	function jumpToLatest() {
		// Re-engage following explicitly: a smooth scroll may never "arrive"
		// at the bottom of a transcript that is still growing.
		followOutput = true;
		$virtualizer.scrollToEnd({ behavior: 'smooth' });
	}

	function jumpToUnread() {
		const first = firstUnread(store.messages, seenMessageId);
		const index = first ? rowIndexOf(rows, first.id) : -1;
		if (index < 0) return jumpToLatest();
		$virtualizer.scrollToIndex(index, { align: 'start', behavior: 'smooth' });
	}

	reveal = async (id: string) => {
		const index = rows.findIndex(
			(row) =>
				row.sourceMessageId === id ||
				row.messages.some(
					(message) =>
						message.id === id || message.tools.some((tool) => tool.id === id),
				),
		);
		if (index < 0 || !viewport) return;
		$virtualizer.scrollToIndex(index, { align: 'center' });
		await tick();
		scrollIntoEnd(
			document.querySelector(`[data-context-id="${id}"]`),
			'smooth',
			'center',
		);
	};

	const measure = createRowMeasurer<HTMLDivElement>(
		(node) => get(virtualizer).measureElement(node),
		() => {
			measureVersion++;
			pinIfFollowing();
		},
	);
</script>

<ScrollPanel name="messages" bind:viewport>
	<div data-ui="message-list">
		<div data-ui="virtual-canvas" style={`height:${totalSize}px`}>
			{#each virtualItems as virtualRow (virtualRow.key)}
				{@const row = rows[virtualRow.index]}
				<!-- Rows can shrink, so an item can outlive its row for a frame. -->
				{#if row}
					<div
						data-ui="virtual-message"
						data-index={virtualRow.index}
						{@attach measure}
						style={`transform:translateY(${virtualRow.start}px)`}
					>
						{#if virtualRow.index === 0 || dayKey(rows[virtualRow.index - 1]!.createdAt) !== dayKey(row.createdAt)}
							<div data-ui="day-separator">
								<span>{formatDay(row.createdAt)}</span>
							</div>
						{/if}
						{#if firstUnreadId && rowIndexOf([row], firstUnreadId) === 0}
							<UnreadMarker />
						{/if}
						{#if row.kind === 'message' || row.kind === 'tool'}
							<MessageGroupView
								group={row}
								toolCount={row.groupedAfter
									? 0
									: turnToolCount(store.messages, row.sourceMessageId)}
								groupedBefore={row.groupedBefore}
								groupedAfter={row.groupedAfter}
								{agentName}
								{expandReasoning}
								{collapseToken}
								{matched}
								onReadAttachment={(id) => store.readAttachment(id)}
								onRevealAttachment={(id) => store.revealAttachment(id)}
								projectPath={currentSession?.projectPath}
								activity={activity.streaming &&
								row.sourceMessageId === lastMessageId &&
								row.activityTarget
									? activity
									: undefined}
							/>
						{:else}
							<ThreadEvent {row} />
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	</div>
</ScrollPanel>

<JumpToLatest
	visible={!followOutput && store.messages.length > 0}
	{unreadCount}
	streaming={activity.streaming}
	onLatest={jumpToLatest}
	onUnread={jumpToUnread}
/>
