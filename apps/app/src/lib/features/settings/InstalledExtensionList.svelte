<script lang="ts">
	import { Settings2, Unlink2 } from '@lucide/svelte';
	import { Switch } from 'bits-ui';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import ExtensionSettings from '../../extensions/ExtensionSettings.svelte';

	interface Installed {
		id: string;
		name: string;
		enabled: boolean;
		pi: boolean;
	}

	let {
		store,
		installed,
		withSettings,
	}: {
		store: AgentStore;
		installed: Installed[];
		/** Extensions whose running instance declared settings fields. */
		withSettings: Set<string>;
	} = $props();
</script>

<div data-ui="skill-list">
	{#each installed as extension (extension.id)}
		<div data-ui="skill-row">
			<div data-ui="skill-row-main">
				<div data-ui="skill-row-title">
					<strong>{extension.name}</strong>
					<span data-ui="skill-row-state" data-on={extension.enabled}
						>{extension.enabled ? 'On' : 'Off'}</span
					>
				</div>
			</div>
			<div data-ui="skill-row-actions">
				<Button
					variant="ghost"
					size="sm"
					title="Uninstall"
					disabled={store.registryBusy}
					onclick={() => void store.registry.registryUnlink(extension.id)}
					aria-label={`Uninstall ${extension.name}`}
				>
					<Unlink2 size={13} />
				</Button>
				<Switch.Root
					data-ui="switch"
					checked={extension.enabled}
					disabled={store.resourcesLoading}
					aria-label={`${extension.name} enabled globally`}
					onCheckedChange={(enabled) =>
						void (extension.pi
							? store.setGlobalExtension(extension.id, enabled)
							: store.setGlobalGizmoExtension(extension.id, enabled))}
				>
					<Switch.Thumb data-ui="switch-thumb" />
				</Switch.Root>
			</div>
		</div>
		{#if withSettings.has(extension.id)}
			<!-- Folded by default: a page of every extension's fields is a
				scroll, and most visits are to flip one switch. -->
			<details data-ui="extension-settings-row">
				<summary>
					<Settings2 size={13} aria-hidden="true" />
					<span>{extension.name} settings</span>
				</summary>
				<div data-ui="extension-settings-body">
					<ExtensionSettings {store} extensionId={extension.id} />
				</div>
			</details>
		{/if}
	{/each}
</div>

<style>
	details[data-ui='extension-settings-row'] {
		border-bottom: 1px solid var(--color-border-subtle);
	}
	summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		color: var(--color-text-muted);
		font-size: var(--text-2xs);
		list-style: none;
		cursor: pointer;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover,
	details[open] summary {
		color: var(--color-text);
	}
	div[data-ui='extension-settings-body'] {
		padding: 0 var(--space-4) var(--space-4);
	}
</style>
