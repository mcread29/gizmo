<script lang="ts">
	import type { TreeRow } from './session-tree';
	import { Bookmark, ChevronDown, ChevronRight } from '@lucide/svelte';

	interface Props {
		rows: TreeRow[];
		selectedId?: string;
		onToggleFold: (id: string) => void;
		onSelect: (id: string) => void;
	}

	let { rows, selectedId, onToggleFold, onSelect }: Props = $props();
</script>

<ol data-ui="tree-list">
	{#each rows as row (row.entry.id)}
		<li
			data-ui="tree-row"
			data-kind={row.entry.kind}
			data-active={row.active || undefined}
			data-leaf={row.leaf || undefined}
			data-selected={row.entry.id === selectedId || undefined}
			style={`--depth:${row.depth}`}
		>
			<button
				data-ui="tree-fold"
				aria-label={row.folded ? 'Unfold' : 'Fold'}
				disabled={!row.foldable}
				onclick={() => onToggleFold(row.entry.id)}
			>
				{#if row.foldable}
					{#if row.folded}<ChevronRight size={13} />{:else}<ChevronDown
							size={13}
						/>{/if}
				{/if}
			</button>
			<button
				data-ui="tree-entry"
				onclick={() => onSelect(row.entry.id)}
				aria-label={`Select ${row.entry.kind}: ${row.entry.summary}`}
			>
				<span data-ui="tree-kind">{row.entry.kind}</span>
				<span data-ui="tree-summary">{row.entry.summary}</span>
				<span data-ui="tree-meta">
					{#if row.entry.label}
						<span data-ui="tree-label">
							<Bookmark size={11} />{row.entry.label}
						</span>
					{/if}
					{#if row.branchCount > 1}
						<span data-ui="tree-branch"
							>branch {row.branchIndex + 1}/{row.branchCount}</span
						>
					{/if}
					{#if row.leaf}<span data-ui="tree-here">here</span>{/if}
				</span>
			</button>
		</li>
	{/each}
</ol>
