<script lang="ts">
	import { Tabs } from 'bits-ui';
	import type { Snippet } from 'svelte';

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
	}: {
		value?: string;
		items: TabItem[];
		children: Snippet<[string]>;
		variant?: 'default' | 'inspector' | 'filter' | 'folder' | 'subtab';
		/** Defer each panel until its first selection, then preserve its state. */
		lazy?: boolean;
	} = $props();

	let mounted = $state(new Set(value ? [value] : []));

	$effect(() => {
		if (!lazy || !value || mounted.has(value)) return;
		mounted = new Set([...mounted, value]);
	});
</script>

<Tabs.Root bind:value data-ui="tabs" data-variant={variant}>
	<Tabs.List data-ui="tabs-list">
		{#each items as item (item.value)}
			<Tabs.Trigger data-ui="tabs-trigger" value={item.value}>
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
