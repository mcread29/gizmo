<script lang="ts">
	import type { Block } from '@gizmo/extension-api';

	type ListBlock = Extract<Block, { type: 'list' }>;

	let {
		block,
		selectedId,
		onSelect,
	}: {
		block: ListBlock;
		selectedId?: string;
		onSelect: (itemId: string) => void;
	} = $props();
</script>

{#if block.items.length === 0}
	<p data-ui="view-empty">{block.empty ?? 'Nothing to show.'}</p>
{:else}
	<ul data-ui="view-list" data-block={block.id}>
		{#each block.items as item (item.id)}
			<li>
				<button
					type="button"
					data-ui="view-list-item"
					data-tone={item.tone}
					data-selected={item.id === selectedId || undefined}
					aria-pressed={item.id === selectedId}
					disabled={item.disabled}
					onclick={() => onSelect(item.id)}
				>
					<span data-ui="view-list-label">{item.label}</span>
					{#if item.detail}<span data-ui="view-list-detail">{item.detail}</span
						>{/if}
				</button>
			</li>
		{/each}
	</ul>
{/if}
