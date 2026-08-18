<script lang="ts">
	import { Tabs } from 'bits-ui';
	import type { Snippet } from 'svelte';

	export interface TabItem {
		value: string;
		label: string;
		/** Rendered as a pill beside the label; omitted when zero. */
		badge?: number;
	}

	let {
		value = $bindable(),
		items,
		children,
	}: {
		value?: string;
		items: TabItem[];
		children: Snippet<[string]>;
	} = $props();
</script>

<Tabs.Root bind:value>
	<Tabs.List data-ui="tabs-list">
		{#each items as item}
			<Tabs.Trigger data-ui="tabs-trigger" value={item.value}>
				{item.label}{#if item.badge}<span data-ui="tabs-badge"
						>{item.badge}</span
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
