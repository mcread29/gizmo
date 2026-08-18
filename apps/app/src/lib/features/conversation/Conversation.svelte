<script lang="ts">
	import type { AgentSessionSummary } from '@unity-agent/protocol';
	import {
		CircleX,
		MoreHorizontal,
		Send,
		Sparkles,
		Square,
	} from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Menu, ScrollPanel } from '../../components';
	import ComposerModelControls from './ComposerModelControls.svelte';
	import ConversationMessage from './ConversationMessage.svelte';

	interface Props {
		store: AgentStore;
		agentName: string;
		currentSession?: AgentSessionSummary;
		sendOnEnter: boolean;
		autoFollowOutput: boolean;
		onRename: () => void;
		onExport: () => void;
		onDelete: () => void;
	}

	let {
		store,
		agentName,
		currentSession,
		sendOnEnter,
		autoFollowOutput,
		onRename,
		onExport,
		onDelete,
	}: Props = $props();
	let draft = $state('');
	let promptElement: HTMLTextAreaElement;
	let scrollAnchor: HTMLDivElement;
	let followOutput = false;

	$effect(() => {
		if (autoFollowOutput) followOutput = true;
	});

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

	function monitorScroll(node: HTMLElement) {
		const viewport = node.closest<HTMLElement>('[data-ui="scroll-viewport"]');
		if (!viewport) return;
		const update = () => {
			followOutput =
				autoFollowOutput &&
				viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 72;
		};
		viewport.addEventListener('scroll', update, { passive: true });
		update();
		return {
			destroy: () => viewport.removeEventListener('scroll', update),
		};
	}

	function sendPrompt() {
		if (!draft.trim() || store.sessionState === 'streaming') return;
		const prompt = draft;
		draft = '';
		void tick().then(() => resizeComposer(promptElement));
		followOutput = autoFollowOutput;
		void store.prompt(prompt);
	}

	function autoGrow(node: HTMLTextAreaElement) {
		const resize = () => resizeComposer(node);
		resize();
		node.addEventListener('input', resize);
		const observer =
			typeof ResizeObserver === 'undefined'
				? undefined
				: new ResizeObserver(resize);
		observer?.observe(node);
		return {
			destroy() {
				node.removeEventListener('input', resize);
				observer?.disconnect();
			},
		};
	}

	function resizeComposer(node: HTMLTextAreaElement | undefined) {
		if (!node) return;
		node.style.height = 'auto';
		const computedMax = Number.parseFloat(getComputedStyle(node).maxHeight);
		const maxHeight = Number.isFinite(computedMax) ? computedMax : 240;
		const height = Math.min(node.scrollHeight, maxHeight);
		node.style.height = `${height}px`;
		node.style.overflowY = node.scrollHeight > maxHeight ? 'auto' : 'hidden';
	}

	function handleComposerKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		const shouldSend = sendOnEnter
			? !event.shiftKey
			: event.metaKey || event.ctrlKey;
		if (shouldSend) {
			event.preventDefault();
			sendPrompt();
		}
	}
</script>

<main
	id="conversation"
	data-ui="conversation"
	data-context-kind="thread"
	data-context-id={currentSession?.id}
	tabindex="-1"
>
	<div data-ui="conversation-header">
		<div>
			<span data-ui="eyebrow">Thread</span>
			<h1>
				{currentSession?.title === 'New session'
					? 'New thread'
					: (currentSession?.title ?? 'New thread')}
			</h1>
		</div>
		<Menu
			items={[
				{ label: 'Rename', onSelect: onRename },
				{ label: 'Export transcript', onSelect: onExport },
				{
					label: 'Delete',
					tone: 'danger',
					disabled: store.sessionState === 'streaming',
					onSelect: onDelete,
				},
			]}
		>
			{#snippet trigger(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Thread actions"><MoreHorizontal size={18} /></Button
				>
			{/snippet}
		</Menu>
	</div>

	<ScrollPanel data-ui="messages">
		<div data-ui="message-list" use:monitorScroll>
			{#if store.error}
				<div data-ui="error-banner" role="alert">
					<CircleX size={17} />{store.error}
				</div>
			{/if}
			{#if store.messages.length === 0}
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
				/>
			{/each}
			<div data-ui="scroll-anchor" bind:this={scrollAnchor}></div>
		</div>
	</ScrollPanel>

	<div data-ui="composer-wrap">
		<form
			data-ui="composer"
			data-context-kind="composer"
			onsubmit={(event) => {
				event.preventDefault();
				sendPrompt();
			}}
		>
			<label for="prompt" data-ui="sr-only">Message Unity Agent</label>
			<textarea
				id="prompt"
				bind:this={promptElement}
				bind:value={draft}
				use:autoGrow
				onkeydown={handleComposerKeydown}
				rows="1"
				placeholder="Ask about your Unity project…"></textarea>
			<div data-ui="composer-toolbar">
				<ComposerModelControls {store} />
				<span data-ui="composer-hint">
					{#if sendOnEnter}
						<kbd>Enter</kbd> send · <kbd>Shift Enter</kbd> newline
					{:else}
						<kbd>⌘/Ctrl Enter</kbd> send · <kbd>Enter</kbd> newline
					{/if}
				</span>
				{#if store.sessionState === 'streaming'}
					<Button
						type="button"
						variant="danger"
						size="icon"
						aria-label="Stop response"
						onclick={() => store.abort()}
					>
						<Square size={14} />
					</Button>
				{:else}
					<Button
						type="submit"
						variant="primary"
						size="icon"
						aria-label="Send message"
						disabled={!draft.trim() ||
							store.connection !== 'connected' ||
							!store.sessionId}
					>
						<Send size={16} />
					</Button>
				{/if}
			</div>
		</form>
		<p data-ui="disclaimer">
			Unity Agent can modify your project. Review changes before committing.
		</p>
	</div>
</main>
