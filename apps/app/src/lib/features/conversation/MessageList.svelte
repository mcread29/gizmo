<script lang="ts">
	import type { AgentSessionSummary } from '@gizmo/protocol';
	import {
		createVirtualizer,
		observeElementRect,
	} from '@tanstack/svelte-virtual';
	import { ArrowDown } from '@lucide/svelte';
	import { onDestroy, tick } from 'svelte';
	import { get } from 'svelte/store';
	import type { AgentStore } from '../../agent-client';
	import { Button, ScrollPanel } from '../../components';
	import type { PiExtensionUiStore } from '../extension-ui/PiExtensionUiStore.svelte';
	import { bottomTolerance, isAtBottom, scrollIntoEnd } from './follow';
	import { dayKey, formatDay } from './message-groups';
	import { createMessageRows, estimateRowHeight } from './message-rows';
	import MessageGroupView from './MessageGroup.svelte';
	import { streamingActivity } from './streaming';

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
	let settleFrame: number | undefined;
	/** Consecutive unchanged frames that count as "the transcript has settled". */
	const settleFrames = 8;
	const settleTimeout = 4_000;

	let activity = $derived(
		streamingActivity(
			store.messages,
			store.sessionState,
			extensionUi?.workingFor(store.sessionId),
		),
	);
	let rows = $derived(createMessageRows(store.messages));
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
	let virtualItems = $derived($virtualizer.getVirtualItems());
	let lastMessageId = $derived(store.messages.at(-1)?.id);

	// The newest message in view while following; anything after it is unread
	// once the user scrolls up. Streaming appends to the same id, so a growing
	// reply does not count as new.
	let seenMessageId = $state<string>();
	let unreadCount = $derived.by(() => {
		if (followOutput || !seenMessageId) return 0;
		const index = store.messages.findIndex(({ id }) => id === seenMessageId);
		return index < 0 ? 0 : store.messages.length - 1 - index;
	});
	$effect(() => {
		if (followOutput) seenMessageId = lastMessageId;
	});

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
	});

	/**
	 * Rows are measured only after they mount, so the total size keeps growing
	 * for several frames after a thread opens. A single scrollToEnd() is issued
	 * against estimates and the newest message then drifts out of view, leaving
	 * the transcript on blank space. Re-pin until the size stops moving.
	 */
	function pinToEnd() {
		cancelSettle();
		let previousSize = -1;
		let previousCount = -1;
		let stable = 0;
		// Switching threads replays the whole transcript, which arrives over many
		// frames, so the settle has to outlast the load rather than a fixed
		// handful of frames. It still gives up rather than spinning forever.
		const deadline = Date.now() + settleTimeout;
		const step = () => {
			settleFrame = undefined;
			const node = viewport;
			if (!node) return;
			const instance = get(virtualizer);
			const size = instance.getTotalSize();
			const count = rows.length;
			instance.scrollToEnd();
			stable =
				size === previousSize && count === previousCount ? stable + 1 : 0;
			previousSize = size;
			previousCount = count;
			if (stable >= settleFrames || Date.now() > deadline) {
				followOutput = isAtBottom(node);
				return;
			}
			settleFrame = requestAnimationFrame(step);
		};
		settleFrame = requestAnimationFrame(step);
	}

	function cancelSettle() {
		if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
		settleFrame = undefined;
	}

	/** Reaching for the transcript hands control back immediately. */
	function releaseOnInput() {
		if (settleFrame === undefined) return;
		cancelSettle();
		if (viewport) followOutput = isAtBottom(viewport);
	}

	onDestroy(cancelSettle);

	// A thread opens at its newest message, not wherever the previous one sat.
	$effect(() => {
		const sessionId = store.sessionId;
		const count = rows.length;
		if (!viewport || !count || sessionId === knownSession) return;
		knownSession = sessionId;
		followOutput = true;
		$virtualizer.measure();
		$virtualizer.scrollToEnd();
		pinToEnd();
	});

	$effect(() => {
		const node = viewport;
		get(virtualizer).setOptions({ getScrollElement: () => node });
		if (!node) return;
		const update = () => {
			followOutput = isAtBottom(node);
		};
		node.addEventListener('scroll', update, { passive: true });
		node.addEventListener('wheel', releaseOnInput, { passive: true });
		node.addEventListener('touchstart', releaseOnInput, { passive: true });
		update();
		return () => {
			node.removeEventListener('scroll', update);
			node.removeEventListener('wheel', releaseOnInput);
			node.removeEventListener('touchstart', releaseOnInput);
		};
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
		const seen = store.messages.findIndex(({ id }) => id === seenMessageId);
		const first = store.messages[seen + 1];
		if (!first) return jumpToLatest();
		const index = rows.findIndex((row) =>
			row.messages.some(({ id }) => id === first.id),
		);
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

	function measure(node: HTMLDivElement) {
		get(virtualizer).measureElement(node);
	}
</script>

<ScrollPanel name="messages" bind:viewport>
	<div data-ui="message-list">
		<div
			data-ui="virtual-canvas"
			style={`height:${$virtualizer.getTotalSize()}px`}
		>
			{#each virtualItems as virtualRow (virtualRow.key)}
				{@const row = rows[virtualRow.index]!}
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
					<MessageGroupView
						group={row}
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
				</div>
			{/each}
		</div>
	</div>
</ScrollPanel>

<!-- Only offered once the user has actually scrolled away from the newest text. -->
{#if !followOutput && store.messages.length > 0}
	<div data-ui="jump-to-latest">
		{#if unreadCount > 0}
			<Button variant="primary" size="sm" onclick={jumpToUnread}
				><ArrowDown size={13} />
				{unreadCount === 1
					? '1 new message'
					: `${unreadCount} new messages`}</Button
			>
		{:else}
			<Button variant="secondary" size="sm" onclick={jumpToLatest}
				><ArrowDown size={13} /> Jump to latest</Button
			>
		{/if}
	</div>
{/if}
