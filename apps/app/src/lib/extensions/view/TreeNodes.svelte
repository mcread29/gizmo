<script lang="ts">
	import type { TreeNode } from '@gizmo/extension-api';
	import ItemActions from './ItemActions.svelte';
	import TreeFolder from './TreeFolder.svelte';
	import TreeLabel from './TreeLabel.svelte';

	let {
		blockId,
		nodes,
		selectedId,
		onSelect,
	}: {
		blockId: string;
		nodes: readonly TreeNode[];
		selectedId?: string;
		onSelect: (itemId: string) => void;
	} = $props();
</script>

<ul data-ui="view-tree-level">
	{#each nodes as node (node.id)}
		{@const selected = node.id === selectedId || undefined}
		<li>
			{#if node.children?.length}
				<TreeFolder {blockId} {node} {selectedId} {onSelect} />
			{:else}
				<!-- The row is a container so its actions are siblings of the
				     selecting control rather than buttons nested inside one. -->
				<div data-ui="view-row" data-selected={selected}>
					<button
						type="button"
						data-ui="view-tree-node"
						data-tone={node.tone}
						data-selected={selected}
						aria-pressed={node.id === selectedId}
						disabled={node.disabled}
						onclick={() => onSelect(node.id)}
					>
						<!-- Stands where a folder's chevron would, so labels on one
						     level start at the same place. -->
						<span data-ui="view-tree-spacer"></span>
						<TreeLabel {node} />
					</button>
					<ItemActions {blockId} itemId={node.id} only={node.actions} />
				</div>
			{/if}
		</li>
	{/each}
</ul>
