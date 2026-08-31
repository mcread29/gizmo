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
	import ConversationPlaceholder from './ConversationPlaceholder.svelte';
	import { isAtBottom, scrollIntoEnd } from './follow';
	import { dayKey, formatDay } from './message-groups';
	import { createMessageRows } from './message-rows';
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

	let scrollAnchor: HTMLDivElement | undefined;
	let followOutput = $state(false);
	let viewport = $state<HTMLElement | null>(null);
	let knownCount = 0;
	let knownSession: string | undefined;
	let rowKeys: Array<string | number> = [];
	let rowEstimates: number[] = [];
	let followTimer: ReturnType<typeof setTimeout> | undefined;

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
		initialRect: initialViewport,
		observeElementRect: (instance, notify) =>
			observeElementRect(instance, (rect) =>
				notify(rect.height > 0 ? rect : initialViewport),
			),
	});
	let virtualItems = $derived($virtualizer.getVirtualItems());
	let lastMessageId = $derived(store.messages.at(-1)?.id);
	let streamRevision = $derived.by(() => {
		const message = store.messages.at(-1);
		const tool = message?.tools.at(-1);
		return `${message?.id}:${message?.content.length}:${message?.reasoning?.length}:${message?.complete}:${tool?.id}:${tool?.status}:${tool?.statusText}`;
	});

	$effect(() => {
		if (autoFollowOutput) followOutput = true;
	});

	$effect(() => {
		const count = rows.length;
		rowKeys = rows.map((row) => row.id);
		rowEstimates = rows.map((row) => (row.kind === 'tool' ? 48 : 220));
		get(virtualizer).setOptions({
			count,
			getItemKey: (index) => rowKeys[index] ?? index,
		});
	});

	// A thread opens at its newest message, not wherever the previous one sat.
	$effect(() => {
		const sessionId = store.sessionId;
		const count = rows.length;
		if (!viewport || !count || sessionId === knownSession) return;
		knownSession = sessionId;
		followOutput = true;
		$virtualizer.measure();
		$virtualizer.scrollToIndex(count - 1, { align: 'end' });
	});

	$effect(() => {
		const node = viewport;
		get(virtualizer).setOptions({ getScrollElement: () => node });
		if (!node) return;
		const update = () => {
			followOutput = isAtBottom(node);
		};
		node.addEventListener('scroll', update, { passive: true });
		update();
		return () => node.removeEventListener('scroll', update);
	});

	// Sending re-engages following even if the user had scrolled up to read.
	$effect(() => {
		const count = store.messages.length;
		if (count > knownCount && store.messages.at(-1)?.role === 'user') {
			followOutput = autoFollowOutput;
		}
		knownCount = count;
	});

	// Only the newest row can grow while streaming. Throttle token updates to a frame.
	$effect(() => {
		streamRevision;
		if (!autoFollowOutput || !followOutput || followTimer !== undefined) return;
		const count = rows.length;
		followTimer = setTimeout(() => {
			followTimer = undefined;
			void tick().then(() => {
				if (count) $virtualizer.scrollToIndex(count - 1, { align: 'end' });
			});
		}, 16);
	});

	onDestroy(() => clearTimeout(followTimer));

	function captureScrollAnchor(node: HTMLDivElement) {
		scrollAnchor = node;
		return () => {
			if (scrollAnchor === node) scrollAnchor = undefined;
		};
	}

	function jumpToLatest() {
		// The scroll listener re-engages following once the anchor is in view.
		scrollIntoEnd(scrollAnchor, 'smooth');
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
		<ConversationPlaceholder
			loading={store.messagesLoading}
			empty={store.messages.length === 0}
		/>
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
		<div data-ui="scroll-anchor" {@attach captureScrollAnchor}></div>
	</div>
</ScrollPanel>

<!-- Only offered once the user has actually scrolled away from the newest text. -->
{#if !followOutput && store.messages.length > 0}
	<div data-ui="jump-to-latest">
		<Button variant="secondary" size="sm" onclick={jumpToLatest}
			><ArrowDown size={13} /> Jump to latest</Button
		>
	</div>
{/if}
