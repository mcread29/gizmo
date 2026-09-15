<script lang="ts">
	import type { SessionTreeEntry } from '@gizmo/protocol';
	import { Bookmark, Copy, GitFork, Pencil } from '@lucide/svelte';
	import { Button } from '../../components';

	interface Props {
		/** The entry the actions apply to, if the user has picked one. */
		selected?: SessionTreeEntry;
		branchCount: number;
		streaming: boolean;
		busy: boolean;
		onLabel: (entry: SessionTreeEntry) => void;
		onCopy: (detail: string) => void;
		onEdit: (entry: SessionTreeEntry) => void;
		onContinue: (entryId: string) => void;
	}

	let {
		selected,
		branchCount,
		streaming,
		busy,
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
		<Button
			variant="secondary"
			size="sm"
			disabled={busy}
			onclick={() => onLabel(selected)}><Bookmark size={13} /> Label</Button
		>
		{#if selected.detail}
			<Button
				variant="secondary"
				size="sm"
				disabled={busy}
				onclick={() => onCopy(selected.detail ?? '')}
				><Copy size={13} /> Copy</Button
			>
		{/if}
		{#if selected.kind === 'user'}
			<Button
				variant="primary"
				size="sm"
				disabled={streaming || busy}
				onclick={() => onEdit(selected)}
				><Pencil size={13} /> Fork and edit</Button
			>
		{:else}
			<Button
				variant="primary"
				size="sm"
				disabled={streaming || busy}
				onclick={() => onContinue(selected.id)}
				><GitFork size={13} /> Start alternate path</Button
			>
		{/if}
	{:else}
		<span data-ui="tree-count">Select a point to start an alternate path.</span>
	{/if}
</footer>
