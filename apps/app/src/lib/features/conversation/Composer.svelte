<script lang="ts">
	import type { AgentAttachment } from '@unity-agent/protocol';
	import {
		CornerDownLeft,
		Minimize2,
		Paperclip,
		Send,
		Square,
	} from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Tooltip } from '../../components';
	import { shortcutHint } from '../shell/shortcuts';
	import { toasts } from '../../toasts.svelte';
	import { maxAttachmentCount, readAttachments } from './attachments';
	import ComposerAttachments from './ComposerAttachments.svelte';
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
	let picker = $state<HTMLInputElement>();
	let dragging = $state(false);
	let attachmentsBySession = $state<Record<string, AgentAttachment[]>>({});

	let draft = $derived(drafts.get(store.sessionId));
	let attachmentKey = $derived(store.sessionId ?? 'unassigned');
	let attachments = $derived(attachmentsBySession[attachmentKey] ?? []);

	$effect(() => {
		if (!store.sessionId) return;
		drafts.adopt(store.sessionId);
		const pending = attachmentsBySession.unassigned;
		if (pending?.length && !attachmentsBySession[store.sessionId]) {
			delete attachmentsBySession.unassigned;
			attachmentsBySession[store.sessionId] = pending;
		}
	});

	function edit(value: string) {
		drafts.set(store.sessionId, value);
	}

	focus = () => element?.focus();

	let streaming = $derived(store.sessionState === 'streaming');
	let canSend = $derived(
		Boolean(draft.trim() || attachments.length) &&
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
		const sentAttachments = [...attachments];
		drafts.clear(store.sessionId);
		delete attachmentsBySession[attachmentKey];
		void tick().then(() => resizeComposer(element));
		void (streaming
			? store.steer(text, sentAttachments)
			: store.prompt(text, sentAttachments));
	}

	async function addFiles(files: Iterable<File>) {
		try {
			const added = await readAttachments(files);
			if (attachments.length + added.length > maxAttachmentCount) {
				throw new Error(`Attach at most ${maxAttachmentCount} files.`);
			}
			attachmentsBySession[attachmentKey] = [...attachments, ...added];
		} catch (error) {
			toasts.show(
				error instanceof Error ? error.message : 'Could not attach that file.',
				'danger',
			);
		}
	}

	function removeAttachment(index: number) {
		attachmentsBySession[attachmentKey] = attachments.filter(
			(_, candidate) => candidate !== index,
		);
	}
</script>

<form
	data-ui="composer"
	data-context-kind="composer"
	data-dragging={dragging || undefined}
	ondragenter={(event) => {
		event.preventDefault();
		dragging = true;
	}}
	ondragover={(event) => event.preventDefault()}
	ondragleave={(event) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null))
			dragging = false;
	}}
	ondrop={(event) => {
		event.preventDefault();
		dragging = false;
		if (event.dataTransfer) void addFiles(event.dataTransfer.files);
	}}
	onsubmit={(event) => {
		event.preventDefault();
		send();
	}}
>
	<input
		bind:this={picker}
		data-ui="attachment-picker"
		type="file"
		multiple
		aria-label="Choose attachments"
		onchange={(event) => {
			void addFiles(event.currentTarget.files ?? []);
			event.currentTarget.value = '';
		}}
	/>
	<ComposerAttachments {attachments} onRemove={removeAttachment} />
	<label for="prompt" data-ui="sr-only">Message Gizmo</label>
	<textarea
		id="prompt"
		bind:this={element}
		value={draft}
		oninput={(event) => edit(event.currentTarget.value)}
		onpaste={(event) => {
			const files = Array.from(event.clipboardData?.files ?? []);
			if (!files.length) return;
			event.preventDefault();
			void addFiles(files);
		}}
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
		<Tooltip text="Attach files or images">
			{#snippet children(props)}
				<Button
					{...props}
					type="button"
					variant="ghost"
					size="icon"
					aria-label="Attach files"
					disabled={attachments.length >= maxAttachmentCount}
					onclick={() => picker?.click()}
				>
					<Paperclip size={14} />
				</Button>
			{/snippet}
		</Tooltip>
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
