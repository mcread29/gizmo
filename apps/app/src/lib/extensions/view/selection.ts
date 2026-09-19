import type { Block, TreeNode } from '@gizmo/extension-api';

/** The block types an action can require a selection in. */
export type SelectableBlock = Extract<
	Block,
	{ type: 'list' | 'table' | 'tree' }
>;

function isSelectable(block: Block): block is SelectableBlock {
	return block.type === 'list' || block.type === 'table' || block.type === 'tree';
}

/** Selectable blocks, including those nested in sections. */
export function selectableBlocks(
	blocks: readonly Block[],
): SelectableBlock[] {
	return blocks.flatMap((block) =>
		block.type === 'section'
			? selectableBlocks(block.blocks)
			: isSelectable(block)
				? [block]
				: [],
	);
}

/** The extension's own initial pick per block, before the user touches one. */
export function initialSelection(
	blocks: readonly Block[],
): Record<string, string> {
	const selection: Record<string, string> = {};
	for (const block of selectableBlocks(blocks)) {
		if (block.selectedId) selection[block.id] = block.selectedId;
	}
	return selection;
}

function treePath(
	nodes: readonly TreeNode[],
	itemId: string,
): string | undefined {
	for (const node of nodes) {
		if (node.id === itemId) return node.path;
		const found = node.children && treePath(node.children, itemId);
		if (found) return found;
	}
}

/** The file path an intent should act on for the item picked in `block`. */
export function itemPath(
	block: SelectableBlock,
	itemId: string,
): string | undefined {
	if (block.type === 'list')
		return block.items.find(({ id }) => id === itemId)?.path;
	if (block.type === 'table')
		return block.rows.find(({ id }) => id === itemId)?.path;
	return treePath(block.nodes, itemId);
}
