<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export interface MenuItem {
		label: string;
		tone?: 'default' | 'danger';
		disabled?: boolean;
		onSelect?: () => void;
	}

	let {
		trigger,
		items,
		align = 'end',
	}: {
		trigger: Snippet<[HTMLButtonAttributes]>;
		items: MenuItem[];
		align?: 'start' | 'center' | 'end';
	} = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}{@render trigger(props)}{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content data-ui="menu-content" sideOffset={6} {align}>
			{#each items as item (item.label)}
				<DropdownMenu.Item
					data-ui="menu-item"
					data-tone={item.tone ?? 'default'}
					disabled={item.disabled}
					onSelect={item.onSelect}
				>
					{item.label}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
