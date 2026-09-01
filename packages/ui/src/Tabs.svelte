<script lang="ts">
	import { Tabs } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { dropEdge, reorderByDrop, type DropEdge } from './reorder';

	export interface TabItem {
		value: string;
		label: string;
		/** A space-saving label used when the tab container is narrow. */
		shortLabel?: string;
		/** Rendered as a pill beside the label; omitted when zero. */
		badge?: number;
		badgeTone?: 'accent' | 'danger';
	}

	let {
		value = $bindable(),
		items,
		children,
		variant = 'default',
		lazy = false,
		reorderable = false,
		onReorder,
	}: {
		value?: string;
		items: TabItem[];
		children: Snippet<[string]>;
		variant?: 'default' | 'inspector' | 'filter' | 'folder' | 'subtab';
		/** Defer each panel until its first selection, then preserve its state. */
		lazy?: boolean;
		/** Lets the user drag triggers into a new order, reported via onReorder. */
		reorderable?: boolean;
		onReorder?: (values: string[]) => void;
	} = $props();

	let dragging = $state<string>();
	let drop = $state<{ value: string; edge: DropEdge }>();

	function dragStart(event: DragEvent, value: string) {
		if (!reorderable) return;
		dragging = value;
		// Firefox will not start a drag without payload.
		event.dataTransfer?.setData('text/plain', value);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function dragOver(event: DragEvent, value: string) {
		if (!dragging || dragging === value) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		drop = {
			value,
			edge: dropEdge(event, event.currentTarget as Element, 'x'),
		};
	}

	function finishDrop(event: DragEvent) {
		event.preventDefault();
		if (dragging && drop) {
			const values = items.map((item) => item.value);
			const next = reorderByDrop(
				values,
				values.indexOf(dragging),
				values.indexOf(drop.value),
				drop.edge,
			);
			if (next.some((value, index) => value !== values[index]))
				onReorder?.(next);
		}
		dragging = undefined;
		drop = undefined;
	}

	let mounted = $state(new Set(value ? [value] : []));

	$effect(() => {
		if (!lazy || !value || mounted.has(value)) return;
		mounted = new Set([...mounted, value]);
	});
</script>

<Tabs.Root bind:value data-ui="tabs" data-variant={variant}>
	<Tabs.List data-ui="tabs-list">
		{#each items as item (item.value)}
			<Tabs.Trigger
				data-ui="tabs-trigger"
				value={item.value}
				draggable={reorderable || undefined}
				data-dragging={dragging === item.value || undefined}
				data-drop={drop?.value === item.value ? drop.edge : undefined}
				ondragstart={(event: DragEvent) => dragStart(event, item.value)}
				ondragover={(event: DragEvent) => dragOver(event, item.value)}
				ondragleave={() => {
					if (drop?.value === item.value) drop = undefined;
				}}
				ondrop={finishDrop}
				ondragend={finishDrop}
			>
				<span data-ui="tabs-label">{item.label}</span>
				{#if item.shortLabel}<span data-ui="tabs-label-short"
						>{item.shortLabel}</span
					>{/if}{#if item.badge}<span
						data-ui="tabs-badge"
						data-tone={item.badgeTone ?? 'accent'}>{item.badge}</span
					>{/if}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>
	{#each items as item (item.value)}
		<Tabs.Content data-ui="tabs-content" value={item.value}>
			{#if !lazy || mounted.has(item.value)}{@render children(item.value)}{/if}
		</Tabs.Content>
	{/each}
</Tabs.Root>
