import { getContext, setContext } from 'svelte';
import type { Action } from '@gizmo/extension-api';

/** The row an action was run on. */
export interface ActionSelection {
	blockId: string;
	itemId: string;
}

/**
 * Row actions reach the blocks that draw them through context rather than
 * props: `ViewBlock` and `TreeNodes` both render themselves, so threading a
 * pair of callbacks down by hand would touch every recursive call site.
 */
export interface ItemActionHost {
	/** The `item` actions bound to a block, in the order the view declared them. */
	forBlock(blockId: string): Action[];
	run(action: Action, blockId: string, itemId: string): void;
}

const key = Symbol('gizmo.view.item-actions');

export function setItemActionHost(host: ItemActionHost): void {
	setContext(key, host);
}

/** Absent when a block is rendered outside a view, as a test may do. */
export function itemActionHost(): ItemActionHost | undefined {
	return getContext(key);
}

/** The `item` actions a view declares, grouped by the block they sit on. */
export function itemActionsByBlock(
	actions: readonly Action[] | undefined,
	readonly_ = false,
): Record<string, Action[]> {
	const grouped: Record<string, Action[]> = {};
	for (const action of actions ?? []) {
		if (action.placement !== 'item' || !action.selection) continue;
		// A read-only card cannot talk to the extension, so only intents show.
		if (readonly_ && !action.intent) continue;
		(grouped[action.selection.blockId] ??= []).push(action);
	}
	return grouped;
}
