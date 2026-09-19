import type { TreeNode } from '@gizmo/extension-api';

/**
 * Collapses a chain of folders that each hold a single folder into one row,
 * the way a file browser shows `a/b/c`. Four levels of indent spent on one
 * changed file is the indent buying nothing, and the inspector is a narrow
 * column. The surviving row keeps the deepest node's identity, so selecting
 * it means what it meant before: the intermediate folders were never
 * selectable targets of their own.
 */
export function compactNodes(nodes: readonly TreeNode[]): TreeNode[] {
	return nodes.map((node) => {
		const labels = [node.label];
		let deepest = node;
		while (deepest.children?.length === 1) {
			const child = deepest.children[0];
			// A lone file is a row of its own, not a suffix on its folder.
			if (!child.children?.length) break;
			labels.push(child.label);
			deepest = child;
		}
		return {
			...deepest,
			label: labels.join('/'),
			...(deepest.children ? { children: compactNodes(deepest.children) } : {}),
		};
	});
}
