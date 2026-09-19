<script lang="ts">
	import type { TreeNode } from '@gizmo/extension-api';
	import { ChevronRight } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import ItemActions from './ItemActions.svelte';
	import TreeLabel from './TreeLabel.svelte';
	import TreeNodes from './TreeNodes.svelte';

	let {
		blockId,
		node,
		selectedId,
		onSelect,
	}: {
		blockId: string;
		node: TreeNode;
		selectedId?: string;
		onSelect: (itemId: string) => void;
	} = $props();

	/*
	 * `expanded` is where the extension opens the folder; folding it is the
	 * user's business, and it is kept here rather than read back from the view
	 * so a poll that redraws the tree does not fold it up again. The node's id
	 * keys the list that renders this component, so the state outlives a
	 * redraw exactly as long as the folder does.
	 */
	let open = $state(untrack(() => node.expanded ?? true));
</script>

<!-- The row is a container so the folder's actions are siblings of the
     control that opens it rather than buttons nested inside one. -->
<div data-ui="view-row" data-selected={node.id === selectedId || undefined}>
	<button
		type="button"
		data-ui="view-tree-node"
		data-tone={node.tone}
		aria-expanded={open}
		onclick={() => {
			open = !open;
			onSelect(node.id);
		}}
	>
		<ChevronRight data-ui="view-tree-chevron" size={13} aria-hidden="true" />
		<TreeLabel {node} />
	</button>
	<!-- A folder's verbs act on everything beneath it, so it carries the ones
	     an extension says can take a directory. -->
	<ItemActions {blockId} itemId={node.id} only={node.actions} />
</div>
{#if open}
	<TreeNodes {blockId} nodes={node.children ?? []} {selectedId} {onSelect} />
{/if}
