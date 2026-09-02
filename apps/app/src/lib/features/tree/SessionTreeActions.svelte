<script lang="ts">
	import type { SessionTreeEntry } from '@gizmo/protocol';
	import { Bookmark, Copy, CornerUpLeft, Pencil } from '@lucide/svelte';
	import { Button } from '../../components';

	interface Props {
		/** The entry the actions apply to, if the user has picked one. */
		selected?: SessionTreeEntry;
		branchCount: number;
		streaming: boolean;
		onLabel: (entry: SessionTreeEntry) => void;
		onCopy: (detail: string) => void;
		onEdit: (entry: SessionTreeEntry) => void;
		onContinue: (entryId: string) => void;
	}

	let {
		selected,
		branchCount,
		streaming,
		onLabel,
		onCopy,
		onEdit,
		onContinue,
	}: Props = $props();
</script>

<footer data-ui="tree-actions">
	{#if branchCount}
		<span data-ui="tree-count"
			>{branchCount} branch point{branchCount === 1 ? '' : 's'}</span
		>
	{/if}
	{#if selected}
		<Button variant="secondary" size="sm" onclick={() => onLabel(selected)}
			><Bookmark size={13} /> Label</Button
		>
		{#if selected.detail}
			<Button
				variant="secondary"
				size="sm"
				onclick={() => onCopy(selected.detail ?? '')}
				><Copy size={13} /> Copy</Button
			>
		{/if}
		{#if selected.kind === 'user'}
			<Button
				variant="secondary"
				size="sm"
				disabled={streaming}
				onclick={() => onEdit(selected)}
				><Pencil size={13} /> Edit and re-run</Button
			>
		{/if}
		<Button
			variant="primary"
			size="sm"
			disabled={streaming}
			onclick={() => onContinue(selected.id)}
			><CornerUpLeft size={13} /> Continue from here</Button
		>
	{:else}
		<span data-ui="tree-count">Select an entry to act on it.</span>
	{/if}
</footer>
