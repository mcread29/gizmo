<script lang="ts">
	import type { ConversationAttachment } from '@gizmo/protocol';
	import { Download, ExternalLink, File } from '@lucide/svelte';
	import { Button, Dialog } from '../../components';
	import type { AttachmentContent } from '../../agent-client/AgentClient';

	interface Props {
		attachments: ConversationAttachment[];
		onRead: (id: string) => Promise<AttachmentContent>;
		onReveal: (id: string) => Promise<void>;
	}

	let { attachments, onRead, onReveal }: Props = $props();
	let error = $state('');

	function previewUrl(attachment: ConversationAttachment): string | undefined {
		return attachment.data
			? `data:${attachment.mimeType};base64,${attachment.data}`
			: undefined;
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	async function download(attachment: ConversationAttachment) {
		try {
			error = '';
			const content = await onRead(attachment.id);
			const binary = atob(content.data);
			const bytes = Uint8Array.from(binary, (character) =>
				character.charCodeAt(0),
			);
			const url = URL.createObjectURL(
				new Blob([bytes], { type: content.mimeType }),
			);
			const link = document.createElement('a');
			link.href = url;
			link.download = content.name;
			link.click();
			URL.revokeObjectURL(url);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		}
	}

	async function reveal(attachment: ConversationAttachment) {
		try {
			error = '';
			await onReveal(attachment.id);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		}
	}
</script>

<div data-ui="message-attachments" aria-label="Attached files">
	{#each attachments as attachment (attachment.id)}
		<div data-ui="message-attachment">
			{#if previewUrl(attachment)}
				<Dialog title={attachment.name} size="lg">
					{#snippet trigger(props)}
						<button
							{...props}
							data-ui="attachment-preview-trigger"
							aria-label={`Preview ${attachment.name}`}
						>
							<img src={previewUrl(attachment)} alt="" />
						</button>
					{/snippet}
					<img
						data-ui="attachment-preview"
						src={previewUrl(attachment)}
						alt={attachment.name}
					/>
				</Dialog>
			{:else}
				<div data-ui="message-attachment-icon"><File size={20} /></div>
			{/if}
			<div data-ui="message-attachment-info">
				<strong>{attachment.name}</strong>
				<small>{formatSize(attachment.size)}</small>
			</div>
			<div data-ui="message-attachment-actions">
				<Button
					variant="ghost"
					size="icon"
					aria-label={`Download ${attachment.name}`}
					onclick={() => void download(attachment)}
					><Download size={14} /></Button
				>
				<Button
					variant="ghost"
					size="icon"
					aria-label={`Reveal ${attachment.name} in folder`}
					onclick={() => void reveal(attachment)}
					><ExternalLink size={14} /></Button
				>
			</div>
		</div>
	{/each}
	{#if error}<p data-ui="attachment-error" role="alert">{error}</p>{/if}
</div>
