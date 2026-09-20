<script lang="ts">
	import type { Component } from 'svelte';
	import type { SettingsPage } from '../../router.svelte';

	export interface SettingsNavItem {
		page: SettingsPage;
		label: string;
		icon: Component<any>;
		badge?: number;
	}

	/** A way out of Settings that still belongs to a group, like a workspace. */
	export interface SettingsNavAction {
		label: string;
		icon: Component<any>;
		onSelect: () => void;
	}

	interface Props {
		/** A group without a title is a plain run of items, with no heading. */
		groups: Array<{
			title?: string;
			items: SettingsNavItem[];
			action?: SettingsNavAction;
		}>;
		current: SettingsPage;
		onSelect: (page: SettingsPage) => void;
	}

	let { groups, current, onSelect }: Props = $props();
</script>

<nav data-ui="settings-nav" aria-label="Settings sections">
	{#each groups as group, index (group.title ?? index)}
		<div data-ui="settings-nav-group">
			{#if group.title}
				<span data-ui="settings-nav-title">{group.title}</span>
			{/if}
			{#each group.items as item (item.page)}
				{@const Icon = item.icon}
				<button
					data-ui="settings-nav-item"
					data-state={item.page === current ? 'active' : 'inactive'}
					aria-current={item.page === current ? 'page' : undefined}
					onclick={() => onSelect(item.page)}
				>
					<Icon size={15} />
					<span>{item.label}</span>
					{#if item.badge}<em data-ui="settings-nav-badge">{item.badge}</em
						>{/if}
				</button>
			{/each}
			{#if group.action}
				{@const ActionIcon = group.action.icon}
				<button data-ui="settings-nav-item" onclick={group.action.onSelect}>
					<ActionIcon size={15} />
					<span>{group.action.label}</span>
				</button>
			{/if}
		</div>
	{/each}
</nav>
