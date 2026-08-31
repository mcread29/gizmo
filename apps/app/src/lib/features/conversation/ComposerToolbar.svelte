<script lang="ts">
	import {
		CornerDownLeft,
		Minimize2,
		Paperclip,
		Send,
		Square,
	} from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Tooltip } from '../../components';
	import { shortcutHint } from '../shell/shortcuts';
	import { maxAttachmentCount } from './attachments';
	import ComposerModelControls from './ComposerModelControls.svelte';
	import UsageMeter from './UsageMeter.svelte';
	import { emptyUsage } from './usage';

	interface Props {
		store: AgentStore;
		attachmentCount: number;
		streaming: boolean;
		canSend: boolean;
		sendOnEnter: boolean;
		onAttach: () => void;
	}

	let {
		store,
		attachmentCount,
		streaming,
		canSend,
		sendOnEnter,
		onAttach,
	}: Props = $props();
</script>

<div data-ui="composer-toolbar">
	<Tooltip text="Attach files or images">
		{#snippet children(props)}
			<Button
				{...props}
				type="button"
				variant="ghost"
				size="icon"
				aria-label="Attach files"
				disabled={attachmentCount >= maxAttachmentCount}
				onclick={onAttach}
			>
				<Paperclip size={14} />
			</Button>
		{/snippet}
	</Tooltip>
	<ComposerModelControls {store} />
	{#if store.sessionId}
		<UsageMeter usage={store.usage ?? emptyUsage(store.model?.contextWindow)} />
	{/if}
	{#if store.compacting}
		<span data-ui="compaction-status">Compacting context…</span>
	{/if}
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
