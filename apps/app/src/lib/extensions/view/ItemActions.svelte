<script lang="ts">
	import { extensionIcon } from '../icons';
	import { itemActionHost } from './item-actions';

	let {
		blockId,
		itemId,
		only,
	}: {
		blockId: string;
		itemId: string;
		/**
		 * The action ids this row carries, when the block's actions do not all
		 * apply to it. Absent means the row carries every one of them.
		 */
		only?: readonly string[];
	} = $props();

	const host = itemActionHost();
	let actions = $derived(
		(host?.forBlock(blockId) ?? []).filter(
			(action) => !only || only.includes(action.id),
		),
	);
</script>

{#if actions.length}
	<!-- Inside a row that is itself a control, so the cluster stops the click
	     from also re-selecting the row underneath it. -->
	<span
		data-ui="view-item-actions"
		role="toolbar"
		tabindex="-1"
		aria-label="Actions"
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => event.stopPropagation()}
	>
		{#each actions as action (action.id)}
			{@const Icon = extensionIcon(action.icon)}
			<button
				type="button"
				data-ui="view-item-action"
				data-tone={action.tone}
				title={action.label}
				aria-label={action.label}
				disabled={action.disabled}
				onclick={() => host?.run(action, blockId, itemId)}
			>
				<Icon size={13} aria-hidden="true" />
			</button>
		{/each}
	</span>
{/if}
