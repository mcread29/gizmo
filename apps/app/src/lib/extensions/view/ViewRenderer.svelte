<script lang="ts">
	import type { ActionEvent, View } from '@gizmo/extension-api';
	import type { ViewIntentHost } from './intents';
	import { initialSelection, itemPath, selectableBlocks } from './selection';
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

	function selectionOf(blockId: string): string | undefined {
		return picked[blockId] ?? defaults[blockId];
	}

	function pathOf(blockId: string): string | undefined {
		const itemId = selectionOf(blockId);
		const block = blocks.find(({ id }) => id === blockId);
		return block && itemId ? itemPath(block, itemId) : undefined;
	}
</script>

<div data-ui="view" data-status={view.status}>
	<div data-ui="view-blocks">
		{#each view.blocks as block, index (index)}
			<ViewBlock
				{block}
				{projectPath}
				{selectionOf}
				onSelect={(blockId, itemId) => (picked[blockId] = itemId)}
			/>
		{/each}
	</div>
	{#if view.actions?.length}
		<ViewActions
			actions={view.actions}
			{selectionOf}
			{pathOf}
			{host}
			{readonly}
			onSend={(event) => onAction?.(event)}
		/>
	{/if}
</div>

<style>
	[data-ui='view'] {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		min-height: 0;
	}
	[data-ui='view-blocks'] {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		min-height: 0;
	}
</style>
