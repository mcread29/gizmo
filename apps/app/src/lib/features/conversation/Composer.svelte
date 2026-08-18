<script lang="ts">
	import { Send, Square } from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Tooltip } from '../../components';
	import { shortcutHint } from '../shell/shortcuts';
	import ComposerModelControls from './ComposerModelControls.svelte';
	import { autoGrow, isSendKey, resizeComposer } from './composer-actions';

	interface Props {
		store: AgentStore;
		sendOnEnter: boolean;
		focus?: () => void;
	}

	let { store, sendOnEnter, focus = $bindable() }: Props = $props();

	let draft = $state('');
	let element = $state<HTMLTextAreaElement>();

	focus = () => element?.focus();

	let canSend = $derived(
		Boolean(draft.trim()) &&
			store.connection === 'connected' &&
			Boolean(store.sessionId) &&
			store.sessionState !== 'streaming',
	);

	function send() {
		if (!canSend) return;
		const prompt = draft;
		draft = '';
		void tick().then(() => resizeComposer(element));
		void store.prompt(prompt);
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
		bind:value={draft}
		use:autoGrow
		onkeydown={(event) => {
			if (!isSendKey(event, sendOnEnter)) return;
			event.preventDefault();
			send();
		}}
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
			<Tooltip text="Stop response">
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
