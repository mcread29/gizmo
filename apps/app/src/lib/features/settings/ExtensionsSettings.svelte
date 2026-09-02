<script lang="ts">
	import { onMount } from 'svelte';
	import { Download, Unlink2, Puzzle } from '@lucide/svelte';
	import { Switch } from 'bits-ui';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote } from '../../components';
	import ExtensionRegistrySection from './ExtensionRegistrySection.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	let url = $state('');

	onMount(() => {
		void store.refreshResources();
		void store.refreshRegistry();
	});

	let extensions = $derived(store.resources?.extensions ?? []);
	let gizmoExtensions = $derived(store.resources?.gizmoExtensions ?? []);
	let registries = $derived(store.registryStatus?.registries ?? []);
	/** Which registry an installed extension was linked from, if any. */
	let installedFrom = $derived(
		new Map(
			registries.flatMap((registry) =>
				registry.extensions
					.filter((extension) => extension.linked)
					.map((extension) => [extension.id, registry.name] as const),
			),
		),
	);

	async function add(event: SubmitEvent) {
		event.preventDefault();
		if (!url.trim()) return;
		const done = await store.registryAdd(url.trim());
		if (done) url = '';
	}

	async function unlink(id: string) {
		const registryName = installedFrom.get(id);
		if (registryName) await store.registryUnlink(registryName, id);
	}
</script>

<SettingsPage
	title="Extensions"
	scope="Git registries cloned locally; linking installs an extension into Pi"
	hideHeader
>
	<p data-ui="resource-detail">
		Extensions live in git registries. Adding a registry clones it to
		<code>{store.registryStatus?.home ?? '…'}</code>; linking an extension
		copies it and its UI into Pi's extensions directory.
	</p>

	{#if store.resourceError}
		<ResourceNote tone="error">{store.resourceError}</ResourceNote>
	{/if}
	{#if store.registryError}
		<ResourceNote tone="error">{store.registryError}</ResourceNote>
	{/if}

	<div data-ui="settings-subhead">
		<strong>Install from a registry</strong>
		<span>Add a Git registry, then install or unlink its extensions below.</span
		>
	</div>
	<div data-ui="settings-card">
		<form class="registry-add" onsubmit={add}>
			<input
				data-ui="text-input"
				placeholder="https://github.com/you/pi-extensions.git"
				bind:value={url}
				disabled={store.registryBusy}
				aria-label="Registry repository URL"
			/>
			<Button type="submit" disabled={store.registryBusy || !url.trim()}>
				<Download size={14} /> Add registry
			</Button>
		</form>
	</div>

	<ExtensionRegistrySection {store} />

	<div data-ui="settings-subhead">
		<strong>Installed extensions</strong>
		<span
			>Enable or disable everything already installed, without removing it.</span
		>
	</div>
	<div data-ui="settings-card">
		{#if store.resourcesLoading && extensions.length === 0 && gizmoExtensions.length === 0}
			<ResourceNote>Loading installed extensions…</ResourceNote>
		{:else if extensions.length === 0 && gizmoExtensions.length === 0}
			<ResourceNote>No extensions are installed.</ResourceNote>
		{:else}
			<div data-ui="skill-list">
				{#each gizmoExtensions as extension (extension.id)}
					<div data-ui="skill-row">
						<div data-ui="skill-row-main">
							<div data-ui="skill-row-title">
								<strong>{extension.name}</strong>
								<em data-ui="resource-scope">Gizmo</em>
								<span data-ui="skill-row-state" data-on={extension.enabled}
									>{extension.enabled ? 'On' : 'Off'}</span
								>
							</div>
						</div>
						<div data-ui="skill-row-actions">
							{#if installedFrom.has(extension.id)}
								<Button
									variant="ghost"
									size="sm"
									disabled={store.registryBusy}
									onclick={() => void unlink(extension.id)}
									aria-label={`Unlink ${extension.name}`}
								>
									<Unlink2 size={13} />
								</Button>
							{/if}
							<Switch.Root
								data-ui="switch"
								checked={extension.enabled}
								disabled={store.resourcesLoading}
								aria-label={`${extension.name} enabled globally`}
								onCheckedChange={(enabled) =>
									void store.setGlobalGizmoExtension(extension.id, enabled)}
							>
								<Switch.Thumb data-ui="switch-thumb" />
							</Switch.Root>
						</div>
					</div>
				{/each}
				{#each extensions as extension (extension.id)}
					<div data-ui="skill-row">
						<div data-ui="skill-row-main">
							<div data-ui="skill-row-title">
								<Puzzle size={15} />
								<strong>{extension.name}</strong>
								<em data-ui="resource-scope">Pi</em>
								<span data-ui="skill-row-state" data-on={extension.enabled}
									>{extension.enabled ? 'On' : 'Off'}</span
								>
							</div>
							<small data-ui="resource-detail" title={extension.path}
								>{extension.kind} · {extension.path}</small
							>
						</div>
						<div data-ui="skill-row-actions">
							{#if installedFrom.has(extension.id)}
								<Button
									variant="ghost"
									size="sm"
									disabled={store.registryBusy}
									onclick={() => void unlink(extension.id)}
									aria-label={`Unlink ${extension.name}`}
								>
									<Unlink2 size={13} />
								</Button>
							{/if}
							<Switch.Root
								data-ui="switch"
								checked={extension.enabled}
								disabled={store.resourcesLoading}
								aria-label={`${extension.name} enabled globally`}
								onCheckedChange={(enabled) =>
									void store.setGlobalExtension(extension.id, enabled)}
							>
								<Switch.Thumb data-ui="switch-thumb" />
							</Switch.Root>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</SettingsPage>

<style>
	.registry-add {
		display: flex;
		gap: var(--space-2);
	}

	.registry-add [data-ui='text-input'] {
		flex: 1;
		width: auto;
	}
</style>
