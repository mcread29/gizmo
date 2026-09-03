<script lang="ts">
	import { CornerDownLeft, Paperclip, Send, Square } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Tooltip } from '../../components';
	import { shortcutHint } from '../shell/shortcuts';
	import { maxAttachmentCount } from './attachments';
	import ComposerModelControls from './ComposerModelControls.svelte';
	import UsageMeter from './UsageMeter.svelte';

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
	<Tooltip
		text={attachmentCount >= maxAttachmentCount
			? `Attachment limit reached (${maxAttachmentCount})`
			: 'Attach files or images'}
	>
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
	<!--
		The meter appears once a response has reported usage, and is itself the
		compact control: compaction is about context size, so the number is the
		natural place to act on it. An empty thread has nothing to show or compact.
	-->
	{#if store.sessionId && store.usage && store.usage.contextUsed > 0}
		<UsageMeter
			usage={store.usage}
			compactDisabled={streaming ||
				store.compacting ||
				store.connection !== 'connected'}
			onCompact={() => void store.compact()}
		/>
	{/if}
	{#if store.compacting}
		<span data-ui="compaction-status">Compacting context…</span>
	{/if}
	<!--
		Stop and Steer sit together at the send position: Stop is the danger
		variant and Steer the primary, with the toolbar gap between them, so the
		pair reads as "this run" rather than two unrelated icons.
	-->
	<div data-ui="composer-send">
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
			<Tooltip
				text={sendOnEnter
					? 'Send · Enter (Shift+Enter for a new line)'
					: `Send · ${shortcutHint('↵')}`}
			>
				{#snippet children(props)}
					<Button
						{...props}
						type="submit"
						variant="primary"
						size="icon"
						aria-label="Send message"
						aria-keyshortcuts={sendOnEnter
							? 'Enter'
							: 'Control+Enter Meta+Enter'}
						disabled={!canSend}
					>
						<Send size={16} />
					</Button>
				{/snippet}
			</Tooltip>
		{/if}
	</div>
</div>
