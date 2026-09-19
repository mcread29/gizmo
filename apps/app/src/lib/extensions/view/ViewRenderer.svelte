<script lang="ts">
	import type { Action, ActionEvent, View } from '@gizmo/extension-api';
	import type { ViewIntentHost } from './intents';
	import {
		itemActionsByBlock,
		setItemActionHost,
		type ActionSelection,
	} from './item-actions';
	import {
		initialSelection,
		itemPath,
		selectableBlocks,
		selectHandlers,
	} from './selection';
	import ViewActions from './ViewActions.svelte';
	import ViewBlock from './ViewBlock.svelte';

	let {
		view,
		projectPath,
		host,
		onAction,
		readonly = false,
	}: {
		view: View;
		projectPath?: string;
		host: ViewIntentHost;
		/** Absent for a read-only card; only intents run then. */
		onAction?: (event: ActionEvent) => void;
		readonly?: boolean;
	} = $props();

	/*
	 * Which row is picked is the client's business, not the extension's: a
	 * view that updates every second would otherwise yank the selection back
	 * to its own `selectedId` while the user is reading. The extension's value
	 * is the starting point, and only for blocks the user has not touched.
	 */
	let picked = $state<Record<string, string>>({});
	let defaults = $derived(initialSelection(view.blocks));
	let blocks = $derived(selectableBlocks(view.blocks));
	let rowActions = $derived(itemActionsByBlock(view.actions, readonly));
	/** An `onSelect` handler is the block's behaviour, not a button. */
	let handled = $derived(selectHandlers(blocks));
	let barActions = $derived(
		(view.actions ?? []).filter((action) => !handled.has(action.id)),
	);
	/** Set by `bind:this`, so every call through it happens after mount. */
	let actions = $state<{
		start: (action: Action, selection?: ActionSelection) => void;
	}>();

	setItemActionHost({
		forBlock: (blockId) => rowActions[blockId] ?? [],
		run: (action, blockId, itemId) =>
			actions?.start(action, { blockId, itemId }),
	});

	function selectionOf(blockId: string): string | undefined {
		return picked[blockId] ?? defaults[blockId];
	}

	function pathOf(blockId: string, itemId?: string): string | undefined {
		const id = itemId ?? selectionOf(blockId);
		const block = blocks.find(({ id: candidate }) => candidate === blockId);
		return block && id ? itemPath(block, id) : undefined;
	}

	/**
	 * Picking a row is local, but a block may also name an action to run on
	 * it — which is how a detail pane follows a selection without the
	 * extension having to offer a "show me" button.
	 */
	function select(blockId: string, itemId: string) {
		picked[blockId] = itemId;
		const named = blocks.find(({ id }) => id === blockId)?.onSelect;
		const action = named && findAction(named);
		if (action)
			actions?.start(action, { blockId, itemId } satisfies ActionSelection);
	}

	function findAction(id: string): Action | undefined {
		return view.actions?.find((action) => action.id === id);
	}
</script>

<div data-ui="view" data-status={view.status}>
	<div data-ui="view-blocks">
		{#each view.blocks as block, index (index)}
			<ViewBlock {block} {projectPath} {selectionOf} onSelect={select} />
		{/each}
	</div>
	<ViewActions
		bind:this={actions}
		actions={barActions}
		{selectionOf}
		{pathOf}
		{host}
		{readonly}
		onSend={(event) => onAction?.(event)}
	/>
</div>
