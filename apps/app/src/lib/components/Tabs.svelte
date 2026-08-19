<script lang="ts">
	import { Tabs } from 'bits-ui';
	import type { Snippet } from 'svelte';

	export interface TabItem {
		value: string;
		label: string;
		/** Rendered as a pill beside the label; omitted when zero. */
		badge?: number;
		badgeTone?: 'accent' | 'danger';
	}

	let {
		value = $bindable(),
		items,
		children,
		variant = 'default',
	}: {
		value?: string;
		items: TabItem[];
		children: Snippet<[string]>;
		variant?: 'default' | 'inspector' | 'filter';
	} = $props();
</script>

<Tabs.Root bind:value data-ui="tabs" data-variant={variant}>
	<Tabs.List data-ui="tabs-list">
		{#each items as item}
			<Tabs.Trigger data-ui="tabs-trigger" value={item.value}>
				{item.label}{#if item.badge}<span
						data-ui="tabs-badge"
						data-tone={item.badgeTone ?? 'accent'}>{item.badge}</span
					>{/if}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>
	{#each items as item}
		<Tabs.Content data-ui="tabs-content" value={item.value}
			>{@render children(item.value)}</Tabs.Content
		>
	{/each}
</Tabs.Root>
