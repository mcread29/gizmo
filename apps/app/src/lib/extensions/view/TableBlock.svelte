<script lang="ts">
	import type { Block } from '@gizmo/extension-api';
	import { extensionIcon, hasExtensionIcon } from '../icons';
	import ItemActions from './ItemActions.svelte';
	import { itemActionHost } from './item-actions';

	type TableBlock = Extract<Block, { type: 'table' }>;

	let {
		block,
		selectedId,
		onSelect,
	}: {
		block: TableBlock;
		selectedId?: string;
		onSelect: (itemId: string) => void;
	} = $props();

	const host = itemActionHost();
	// The actions column exists only when there is something to put in it.
	let hasItemActions = $derived((host?.forBlock(block.id) ?? []).length > 0);
</script>

{#if block.rows.length === 0}
	<p data-ui="view-empty">{block.empty ?? 'Nothing to show.'}</p>
{:else}
	<table data-ui="view-table" data-block={block.id}>
		<thead>
			<tr>
				{#each block.columns as column (column.id)}
					<th scope="col" style:text-align={column.align ?? 'start'}
						>{column.label}</th
					>
				{/each}
				{#if hasItemActions}<th scope="col" aria-label="Actions"></th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each block.rows as row (row.id)}
				{@const Icon = extensionIcon(row.icon)}
				<!-- Rows are selectable, so the row itself is the control; a
				     button per cell would make the table unusable by keyboard. -->
				<tr
					data-ui="view-row"
					data-tone={row.tone}
					data-selected={row.id === selectedId || undefined}
					aria-selected={row.id === selectedId}
					aria-disabled={row.disabled || undefined}
					tabindex={row.disabled ? undefined : 0}
					onclick={() => !row.disabled && onSelect(row.id)}
					onkeydown={(event) => {
						if (row.disabled || (event.key !== 'Enter' && event.key !== ' '))
							return;
						event.preventDefault();
						onSelect(row.id);
					}}
				>
					{#each block.columns as column, index (column.id)}
						<td style:text-align={column.align ?? 'start'}>
							{#if index === 0 && hasExtensionIcon(row.icon)}
								<Icon data-ui="view-row-icon" size={13} aria-hidden="true" />
							{/if}{row.cells[column.id] ??
								''}{#if index === 0 && row.badge}<span
									data-ui="view-row-badge"
									data-tone={row.badge.tone}>{row.badge.text}</span
								>{/if}
						</td>
					{/each}
					{#if hasItemActions}
						<td style:text-align="end">
							<ItemActions
								blockId={block.id}
								itemId={row.id}
								only={row.actions}
							/>
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
