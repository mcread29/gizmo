<script lang="ts">
	import { onMount } from 'svelte';
	import { RefreshCw } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import { extensionUi } from '../../extensions/extension-ui.svelte';
	import ExtensionRegistrySection from './ExtensionRegistrySection.svelte';
	import InstalledExtensionList from './InstalledExtensionList.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	onMount(() => {
		void store.refreshResources();
		void store.registry.refreshRegistry();
	});

	let piExtensions = $derived(store.resources?.extensions ?? []);
	let gizmoExtensions = $derived(store.resources?.gizmoExtensions ?? []);
	let registryExtensions = $derived(store.registryStatus?.extensions ?? []);
	/**
	 * Everything installed comes from the one registry, so the linked entries
	 * are the list. Their enabled state lives with the host: the Pi extension
	 * list for plain extensions, the Gizmo list for ones with a server-side
	 * integration.
	 */
	let installed = $derived(
		registryExtensions
			.filter(({ linked }) => linked)
			.map((extension) => {
				const pi = piExtensions.find(({ id }) => id === extension.id);
				const gizmo = gizmoExtensions.find(({ id }) => id === extension.id);
				return {
					id: extension.id,
					name: gizmo?.name ?? pi?.name ?? extension.name,
					enabled: gizmo?.enabled ?? pi?.enabled ?? false,
					pi: pi !== undefined,
				};
			})
			.sort((left, right) => left.name.localeCompare(right.name)),
	);
	let loading = $derived(store.resourcesLoading && installed.length === 0);
	/**
	 * A settings form needs the fields the extension declares, which only the
	 * running extension reports, so it shows for the ones the selected
	 * workspace has enabled. The values themselves are global.
	 */
	let withSettings = $derived(
		new Set(
			extensionUi.extensions
				.filter((extension) => extension.settings.length > 0)
				.map(({ id }) => id),
		),
	);

	/** Installed and Registry are long lists; one at a time keeps the page short. */
	let section = $state<'installed' | 'registry'>('installed');
	let reloading = $state(false);
	/** In-place reload of every linked extension; no server restart. */
	async function reload() {
		reloading = true;
		try {
			const diagnostics = await store.reloadExtensions();
			toasts.show(
				diagnostics.length
					? 'Extensions reloaded with warnings'
					: 'Extensions reloaded',
				diagnostics.length ? 'warning' : 'success',
			);
			for (const diagnostic of diagnostics) console.warn(diagnostic);
		} catch (error) {
			toasts.show(
				error instanceof Error ? error.message : 'Extension reload failed',
				'danger',
			);
		} finally {
			reloading = false;
		}
	}
</script>

<SettingsPage
	title="Extensions"
	scope="Each workspace can switch one off in its Configure screen"
>
	{#if store.resourceError}
		<ResourceNote tone="error">{store.resourceError}</ResourceNote>
	{/if}
	{#if store.registryError}
		<ResourceNote tone="error">{store.registryError}</ResourceNote>
	{/if}

	<div data-ui="segmented" role="tablist" aria-label="Extension lists">
		<button
			type="button"
			data-ui="segmented-option"
			data-state={section === 'installed' ? 'active' : 'inactive'}
			role="tab"
			aria-selected={section === 'installed'}
			onclick={() => (section = 'installed')}
			>Installed{#if installed.length}
				<span data-ui="segmented-count">{installed.length}</span>{/if}</button
		>
		<button
			type="button"
			data-ui="segmented-option"
			data-state={section === 'registry' ? 'active' : 'inactive'}
			role="tab"
			aria-selected={section === 'registry'}
			onclick={() => (section = 'registry')}>Registry</button
		>
	</div>

	{#if section === 'installed'}
		<div data-ui="settings-subhead">
			<h3>Installed</h3>
			<span
				>Gizmo extensions add tools, panels, and project services. Off keeps one
				installed but out of every thread. Reload picks up edited extension
				source without restarting the server.</span
			>
			<Button
				variant="secondary"
				size="sm"
				disabled={reloading || store.registryBusy}
				onclick={() => void reload()}
			>
				<RefreshCw size={13} />
				{reloading ? 'Reloading…' : 'Reload extensions'}
			</Button>
		</div>
		<div data-ui="settings-list">
			{#if loading}
				<ResourceNote>Loading installed extensions…</ResourceNote>
			{:else if installed.length === 0}
				<ResourceNote>
					No Gizmo extensions are installed. Install one from the Registry.
				</ResourceNote>
			{:else}
				<InstalledExtensionList {store} {installed} {withSettings} />
			{/if}
		</div>
	{:else}
		<div data-ui="settings-subhead">
			<h3>Registry</h3>
			<span
				>Gizmo's extension repository, cloned to
				<code>{store.registryStatus?.home ?? '…'}</code>. Install links an
				extension into Pi; uninstall unlinks it.</span
			>
		</div>

		<ExtensionRegistrySection {store} />
	{/if}
</SettingsPage>

<style>
	[data-ui='segmented'] {
		justify-self: start;
	}
	[data-ui='segmented-count'] {
		margin-left: 6px;
		color: var(--color-text-faint);
		font-weight: 500;
	}
</style>
