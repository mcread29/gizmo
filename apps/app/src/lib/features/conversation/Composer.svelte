<script lang="ts">
	import { CornerDownLeft, Minimize2, Send, Square } from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Tooltip } from '../../components';
	import { shortcutHint } from '../shell/shortcuts';
	import ComposerModelControls from './ComposerModelControls.svelte';
	import UsageMeter from './UsageMeter.svelte';
	import { autoGrow, isSendKey, resizeComposer } from './composer-actions';
	import type { DraftStore } from './drafts.svelte';

	interface Props {
		store: AgentStore;
		drafts: DraftStore;
		sendOnEnter: boolean;
		focus?: () => void;
	}

	let { store, drafts, sendOnEnter, focus = $bindable() }: Props = $props();

	let element = $state<HTMLTextAreaElement>();

	let draft = $derived(drafts.get(store.sessionId));

	$effect(() => {
		if (store.sessionId) drafts.adopt(store.sessionId);
	});

	function edit(value: string) {
		drafts.set(store.sessionId, value);
	}

	focus = () => element?.focus();

	let streaming = $derived(store.sessionState === 'streaming');
	let canSend = $derived(
		Boolean(draft.trim()) &&
			store.connection === 'connected' &&
			Boolean(store.sessionId),
	);

	/*
	 * While a response is streaming the same control steers the run in flight
	 * rather than queueing a new turn, so redirecting the agent does not mean
	 * throwing away the work it has already done.
	 */
	function send() {
		if (!canSend) return;
		const text = draft;
		drafts.clear(store.sessionId);
		void tick().then(() => resizeComposer(element));
		void (streaming ? store.steer(text) : store.prompt(text));
	}
</script>

<form
	data-ui="composer"
	data-context-kind="composer"
	onsubmit={(event) => {
		event.preventDefault();
		send();
	}}
>
	<label for="prompt" data-ui="sr-only">Message Unity Agent</label>
	<textarea
		id="prompt"
		bind:this={element}
		value={draft}
		oninput={(event) => edit(event.currentTarget.value)}
		use:autoGrow
		onkeydown={(event) => {
			// An empty composer recalls the last prompt, for fixing a typo in it.
			if (event.key === 'ArrowUp' && !draft && store.lastPrompt) {
				event.preventDefault();
				edit(store.lastPrompt);
				return;
			}
			if (!isSendKey(event, sendOnEnter)) return;
			event.preventDefault();
			send();
		}}
		rows="1"
		placeholder={streaming
			? 'Steer the response while it runs…'
			: 'Ask about your Unity project…'}></textarea>
	<div data-ui="composer-toolbar">
		<ComposerModelControls {store} />
		{#if store.usage}<UsageMeter usage={store.usage} />{/if}
		{#if store.compacting}<span data-ui="compaction-status"
				>Compacting context…</span
			>{/if}
		<Tooltip text="Compact context now">
			{#snippet children(props)}
				<Button
					{...props}
					type="button"
					variant="ghost"
					size="icon"
					aria-label="Compact context"
					disabled={streaming ||
						store.compacting ||
						store.connection !== 'connected' ||
						!store.sessionId}
					onclick={() => void store.compact()}
				>
					<Minimize2 size={14} />
				</Button>
			{/snippet}
		</Tooltip>
		<span data-ui="composer-hint">
			{#if streaming}
				Steering
			{:else if sendOnEnter}
				<kbd>Enter</kbd> send · <kbd>Shift Enter</kbd> newline
			{:else}
				<kbd>⌘/Ctrl Enter</kbd> send · <kbd>Enter</kbd> newline
			{/if}
		</span>
		{#if streaming}
			<Tooltip text="Stop the response and keep what has been written">
				{#snippet children(props)}
					<Button
						{...props}
						type="button"
						variant="danger"
						size="icon"
						aria-label="Stop response"
						onclick={() => store.abort()}
					>
						<Square size={14} />
					</Button>
				{/snippet}
			</Tooltip>
			<Tooltip text="Add direction without interrupting the run">
				{#snippet children(props)}
					<Button
						{...props}
						type="submit"
						variant="primary"
						size="icon"
						aria-label="Steer response"
						disabled={!canSend}
					>
						<CornerDownLeft size={16} />
					</Button>
				{/snippet}
			</Tooltip>
		{:else}
			<Tooltip text={`Send message · ${shortcutHint('↵')}`}>
				{#snippet children(props)}
					<Button
						{...props}
						type="submit"
						variant="primary"
						size="icon"
						aria-label="Send message"
						disabled={!canSend}
					>
						<Send size={16} />
					</Button>
				{/snippet}
			</Tooltip>
		{/if}
	</div>
</form>
