<script lang="ts">
	import type { TreeNode } from '@gizmo/extension-api';
	import TreeNodes from './TreeNodes.svelte';

	let {
		nodes,
		selectedId,
		onSelect,
	}: {
		nodes: readonly TreeNode[];
		selectedId?: string;
		onSelect: (itemId: string) => void;
	} = $props();
</script>

<ul data-ui="view-tree-level">
	{#each nodes as node (node.id)}
		<li>
			<!-- `expanded` is the extension's opening state; collapsing is the
			     browser's, so a re-render does not fold the tree back up. -->
			{#if node.children?.length}
				<details open={node.expanded ?? true}>
					<summary
						data-ui="view-tree-node"
						data-tone={node.tone}
						data-selected={node.id === selectedId || undefined}
						onclick={() => onSelect(node.id)}
					>
						<span>{node.label}</span>
						{#if node.detail}<small>{node.detail}</small>{/if}
					</summary>
					<TreeNodes nodes={node.children} {selectedId} {onSelect} />
				</details>
			{:else}
				<button
					type="button"
					data-ui="view-tree-node"
					data-tone={node.tone}
					data-selected={node.id === selectedId || undefined}
					aria-pressed={node.id === selectedId}
					disabled={node.disabled}
					onclick={() => onSelect(node.id)}
				>
					<span>{node.label}</span>
					{#if node.detail}<small>{node.detail}</small>{/if}
				</button>
			{/if}
		</li>
	{/each}
</ul>
