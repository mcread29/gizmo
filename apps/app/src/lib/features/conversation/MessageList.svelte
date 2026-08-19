<script lang="ts">
	import type {
		AgentSessionSummary,
		ConversationMessage,
	} from '@unity-agent/protocol';
	import {
		createVirtualizer,
		observeElementRect,
	} from '@tanstack/svelte-virtual';
	import { onDestroy, tick } from 'svelte';
	import { get } from 'svelte/store';
	import type { AgentStore } from '../../agent-client';
	import { ArrowDown } from '@lucide/svelte';
	import { BrandMark, Button, ScrollPanel } from '../../components';
	import MessageGroupView from './MessageGroup.svelte';
	import { isAtBottom, scrollIntoEnd } from './follow';
	import { dayKey, formatDay, groupMessages } from './message-groups';
	import { streamingActivity } from './streaming';

	interface Props {
		store: AgentStore;
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
		agentName,
		currentSession,
		autoFollowOutput,
		expandReasoning,
		collapseToken,
		matched,
		reveal = $bindable(),
	}: Props = $props();

	let scrollAnchor = $state<HTMLDivElement>();
	let followOutput = $state(false);
	let viewport = $state<HTMLElement | null>(null);
	let knownCount = 0;
	let knownSession: string | undefined;
	let rowKeys: Array<string | number> = [];
	let rowEstimates: number[] = [];
	let followTimer: ReturnType<typeof setTimeout> | undefined;
	let activity = $derived(
		streamingActivity(store.messages, store.sessionState),
	);
	let groups = $derived(groupMessages(store.messages));
	const initialViewport = { width: 800, height: 800 };
	let rows = $derived(
		groups.flatMap((group) =>
			group.messages
				.flatMap(splitMessage)
				.map(({ message, sourceMessageId, kind }, index, messages) => ({
					id: message.id,
					role: group.role,
					createdAt: message.createdAt,
					messages: [message],
					sourceMessageId,
					kind,
					activityTarget: index === messages.length - 1,
					groupedBefore: index > 0,
					groupedAfter: index < messages.length - 1,
				})),
		),
	);
	const virtualizer = createVirtualizer<HTMLElement, HTMLDivElement>({
		count: 0,
		getScrollElement: () => viewport ?? null,
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
		get(virtualizer).setOptions({ getScrollElement: () => node ?? null });
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

	// Only the newest message can grow while streaming. Reading the whole
	// transcript here made every token increasingly expensive on long threads.
	$effect(() => {
		streamRevision;
		if (!autoFollowOutput || !followOutput) return;
		if (followTimer !== undefined) return;
		const count = rows.length;
		followTimer = setTimeout(() => {
			followTimer = undefined;
			void tick().then(() => {
				if (count) {
					$virtualizer.scrollToIndex(count - 1, { align: 'end' });
				}
			});
		}, 16);
	});

	onDestroy(() => clearTimeout(followTimer));

	function jumpToLatest() {
		// The scroll listener re-engages following once the anchor is in view.
		scrollIntoEnd(scrollAnchor, 'smooth');
	}

	reveal = async (id: string) => {
		const index = rows.findIndex((row) =>
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
		$virtualizer.measureElement(node);
	}

	function splitMessage(message: ConversationMessage) {
		const rows: Array<{
			message: ConversationMessage;
			sourceMessageId: string;
			kind: 'message' | 'tool';
		}> = [];
		const hasMessageBody = Boolean(
			message.content ||
				message.reasoning ||
				message.reasoningRedacted ||
				message.attachments?.length ||
				message.tools.length === 0,
		);
		if (hasMessageBody) {
			rows.push({
				message: { ...message, tools: [] },
				sourceMessageId: message.id,
				kind: 'message',
			});
		}
		for (const tool of message.tools) {
			rows.push({
				message: {
					...message,
					id: `${message.id}:tool:${tool.id}`,
					content: '',
					reasoning: undefined,
					reasoningRedacted: undefined,
					attachments: undefined,
					tools: [tool],
				},
				sourceMessageId: message.id,
				kind: 'tool',
			});
		}
		return rows;
	}

</script>

<ScrollPanel name="messages" bind:viewport>
	<div data-ui="message-list">
		{#if store.messagesLoading && store.messages.length === 0}
			<div data-ui="message-skeleton" aria-label="Loading transcript">
				{#each { length: 3 } as _, index (index)}
					<div data-ui="skeleton" data-shape="avatar"></div>
					<div>
						<div data-ui="skeleton" data-shape="line"></div>
						<div data-ui="skeleton" data-shape="line" data-width="short"></div>
					</div>
				{/each}
			</div>
		{:else if store.messages.length === 0}
			<div data-ui="conversation-empty">
				<div data-ui="brand-mark"><BrandMark size={38} /></div>
				<h2>Ready when you are</h2>
				<p>
					Ask about the open project, inspect the Editor, or run a registered
					command.
				</p>
			</div>
		{/if}
		<div
			data-ui="virtual-canvas"
			style={`height:${$virtualizer.getTotalSize()}px`}
		>
			{#each virtualItems as virtualRow (virtualRow.key)}
				{@const row = rows[virtualRow.index]!}
				<div
					data-ui="virtual-message"
					data-index={virtualRow.index}
					use:measure
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
		<div data-ui="scroll-anchor" bind:this={scrollAnchor}></div>
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
