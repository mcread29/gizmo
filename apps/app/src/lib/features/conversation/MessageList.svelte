<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	import type { AgentSessionSummary } from '@unity-agent/protocol';
	import { tick } from 'svelte';
	import type { AgentStore } from '../../agent-client';
	import { ArrowDown } from '@lucide/svelte';
	import { Button, ScrollPanel } from '../../components';
	import ConversationMessage from './ConversationMessage.svelte';
	import { isAtBottom } from './follow';
	import { streamingActivity } from './streaming';

	interface Props {
		store: AgentStore;
		agentName: string;
		currentSession?: AgentSessionSummary;
		autoFollowOutput: boolean;
	}

	let { store, agentName, currentSession, autoFollowOutput }: Props = $props();

	let scrollAnchor = $state<HTMLDivElement>();
	let followOutput = $state(false);
	let knownCount = 0;
	let activity = $derived(
		streamingActivity(store.messages, store.sessionState),
	);

	$effect(() => {
		if (autoFollowOutput) followOutput = true;
	});

	// Sending re-engages following even if the user had scrolled up to read.
	$effect(() => {
		const count = store.messages.length;
		if (count > knownCount && store.messages.at(-1)?.role === 'user') {
			followOutput = autoFollowOutput;
		}
		knownCount = count;
	});

	// Reading the transcript shape is what makes this effect re-run on stream.
	$effect(() => {
		store.messages
			.map(
				(message) =>
					`${message.id}:${message.content.length}:${message.complete}:${message.tools.map((tool) => `${tool.id}:${tool.status}:${tool.statusText}`).join(',')}`,
			)
			.join('|');
		if (!autoFollowOutput || !followOutput) return;
		let cancelled = false;
		void tick().then(() => {
			if (!cancelled && typeof scrollAnchor?.scrollIntoView === 'function') {
				scrollAnchor.scrollIntoView({ block: 'end' });
			}
		});
		return () => (cancelled = true);
	});

	function jumpToLatest() {
		// The scroll listener re-engages following once the anchor is in view.
		scrollAnchor?.scrollIntoView({ block: 'end', behavior: 'smooth' });
	}

	/** Stops following as soon as the user scrolls away from the bottom. */
	function monitorScroll(node: HTMLElement) {
		const viewport = node.closest<HTMLElement>('[data-ui="scroll-viewport"]');
		if (!viewport) return;
		const update = () => (followOutput = isAtBottom(viewport));
		viewport.addEventListener('scroll', update, { passive: true });
		update();
		return {
			destroy: () => viewport.removeEventListener('scroll', update),
		};
	}
</script>

<ScrollPanel name="messages">
	<div data-ui="message-list" use:monitorScroll>
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
				<div data-ui="brand-mark"><Sparkles size={18} /></div>
				<h2>Ready when you are</h2>
				<p>
					Ask about the open project, inspect the Editor, or run a registered
					command.
				</p>
			</div>
		{/if}
		{#each store.messages as message (message.id)}
			<ConversationMessage
				{message}
				{agentName}
				projectPath={currentSession?.projectPath}
				onRetry={message.role === 'user'
					? () => void store.retryPrompt()
					: undefined}
				activity={activity.streaming && message.id === store.messages.at(-1)?.id
					? activity
					: undefined}
			/>
		{/each}
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
