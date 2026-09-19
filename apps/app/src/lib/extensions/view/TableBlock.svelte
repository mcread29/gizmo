<script lang="ts">
	import type { Block } from '@gizmo/extension-api';

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
			</tr>
		</thead>
		<tbody>
			{#each block.rows as row (row.id)}
				<!-- Rows are selectable, so the row itself is the control; a
				     button per cell would make the table unusable by keyboard. -->
				<tr
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
					{#each block.columns as column (column.id)}
						<td style:text-align={column.align ?? 'start'}
							>{row.cells[column.id] ?? ''}</td
						>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
