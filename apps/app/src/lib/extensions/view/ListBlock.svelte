<script lang="ts">
	import type { Block } from '@gizmo/extension-api';
	import { extensionIcon, hasExtensionIcon } from '../icons';
	import ItemActions from './ItemActions.svelte';

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
			{@const Icon = extensionIcon(item.icon)}
			{@const selected = item.id === selectedId || undefined}
			<li data-ui="view-row" data-selected={selected}>
				<button
					type="button"
					data-ui="view-list-item"
					data-tone={item.tone}
					data-selected={selected}
					aria-pressed={item.id === selectedId}
					disabled={item.disabled}
					onclick={() => onSelect(item.id)}
				>
					{#if hasExtensionIcon(item.icon)}
						<Icon data-ui="view-row-icon" size={13} aria-hidden="true" />
					{/if}
					<span data-ui="view-list-label">{item.label}</span>
					{#if item.detail}<span data-ui="view-list-detail">{item.detail}</span
						>{/if}
					{#if item.badge}<span
							data-ui="view-row-badge"
							data-tone={item.badge.tone}>{item.badge.text}</span
						>{/if}
				</button>
				<ItemActions blockId={block.id} itemId={item.id} only={item.actions} />
			</li>
		{/each}
	</ul>
{/if}
