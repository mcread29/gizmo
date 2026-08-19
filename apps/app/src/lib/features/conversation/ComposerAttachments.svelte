<script lang="ts">
	import type { AgentAttachment } from '@unity-agent/protocol';
	import { File as FileIcon, X } from '@lucide/svelte';
	import { attachmentSize, attachmentUrl } from './attachments';

	let {
		attachments,
		onRemove,
	}: { attachments: AgentAttachment[]; onRemove: (index: number) => void } =
		$props();
</script>

{#if attachments.length}
	<div data-ui="attachment-list" aria-label="Attachments">
		{#each attachments as attachment, index (`${attachment.name}-${index}`)}
			<div data-ui="attachment-chip">
				{#if attachment.mimeType.startsWith('image/')}
					<img src={attachmentUrl(attachment)} alt="" />
				{:else}
					<FileIcon size={18} />
				{/if}
				<span>
					<strong>{attachment.name}</strong>
					<small>{attachmentSize(attachment)}</small>
				</span>
				<button
					type="button"
					aria-label={`Remove ${attachment.name}`}
					onclick={() => onRemove(index)}
				>
					<X size={13} />
				</button>
			</div>
		{/each}
	</div>
{/if}
