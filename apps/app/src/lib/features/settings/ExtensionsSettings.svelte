<script lang="ts">
	import { onMount } from 'svelte';
	import { Download, RefreshCw, Unlink2 } from '@lucide/svelte';
	import { Switch } from 'bits-ui';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import ExtensionRegistrySection from './ExtensionRegistrySection.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	let url = $state('');
	let showOtherPi = $state(false);

	onMount(() => {
		void store.refreshResources();
		void store.refreshRegistry();
	});

	let piExtensions = $derived(store.resources?.extensions ?? []);
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
	/**
	 * This page is about Gizmo extensions: the ones registered with the host,
	 * plus anything linked from a registry that has not registered (yet). A
	 * plain Pi extension the user dropped into Pi's directory is Pi's business;
	 * it stays behind a fold so it can still be switched off from here.
	 */
	let installed = $derived.by(() => {
		const known = new Set(gizmoExtensions.map(({ id }) => id));
		const linked = piExtensions
			.filter(({ id }) => installedFrom.has(id) && !known.has(id))
			.map(({ id, name, enabled }) => ({ id, name, enabled, pi: true }));
		return [
			...gizmoExtensions.map((extension) => ({
				...extension,
				pi: piExtensions.some(({ id }) => id === extension.id),
			})),
			...linked,
		].sort((left, right) => left.name.localeCompare(right.name));
	});
	let otherPi = $derived(
		piExtensions.filter(
			({ id }) =>
				!installedFrom.has(id) && !gizmoExtensions.some((g) => g.id === id),
		),
	);
	let loading = $derived(
		store.resourcesLoading &&
			piExtensions.length === 0 &&
			installed.length === 0,
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
	scope="Installed globally · each workspace can switch one off in Configure"
>
	{#if store.resourceError}
		<ResourceNote tone="error">{store.resourceError}</ResourceNote>
	{/if}
	{#if store.registryError}
		<ResourceNote tone="error">{store.registryError}</ResourceNote>
	{/if}

	<div data-ui="settings-subhead">
		<strong>Installed</strong>
		<span
			>Gizmo extensions add tools, panels, and project services. Off keeps one
			installed but out of every thread. Reload picks up edited extension source
			without restarting the server.</span
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
	<div data-ui="settings-card">
		{#if loading}
			<ResourceNote>Loading installed extensions…</ResourceNote>
		{:else if installed.length === 0}
			<ResourceNote>
				No Gizmo extensions are installed. Add a registry below and install from
				it.
			</ResourceNote>
		{:else}
			<div data-ui="skill-list">
				{#each installed as extension (extension.id)}
					<div data-ui="skill-row">
						<div data-ui="skill-row-main">
							<div data-ui="skill-row-title">
								<strong>{extension.name}</strong>
								{#if installedFrom.has(extension.id)}
									<em data-ui="resource-scope"
										>{installedFrom.get(extension.id)}</em
									>
								{/if}
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
									title="Uninstall"
									disabled={store.registryBusy}
									onclick={() => void unlink(extension.id)}
									aria-label={`Uninstall ${extension.name}`}
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
									void (extension.pi
										? store.setGlobalExtension(extension.id, enabled)
										: store.setGlobalGizmoExtension(extension.id, enabled))}
							>
								<Switch.Thumb data-ui="switch-thumb" />
							</Switch.Root>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div data-ui="settings-subhead">
		<strong>Registries</strong>
		<span
			>A registry is a Git repository of extensions, cloned to
			<code>{store.registryStatus?.home ?? '…'}</code>. Install links an
			extension into Pi; uninstall unlinks it.</span
		>
	</div>
	<div data-ui="settings-card">
		<form class="registry-add" onsubmit={add}>
			<input
				data-ui="text-input"
				placeholder="https://github.com/you/gizmo-registry.git"
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

	{#if otherPi.length > 0}
		<!-- Pi extensions Gizmo did not install. Folded: they are not what this
		     page is for, but a stray one is worth being able to turn off. -->
		<details class="other-pi" bind:open={showOtherPi}>
			<summary>
				{showOtherPi ? 'Hide' : 'Show'}
				{otherPi.length === 1
					? '1 other Pi extension'
					: `${otherPi.length} other Pi extensions`} found in Pi's directory
			</summary>
			<div data-ui="settings-card">
				<div data-ui="skill-list">
					{#each otherPi as extension (extension.id)}
						<div data-ui="skill-row">
							<div data-ui="skill-row-main">
								<div data-ui="skill-row-title">
									<strong>{extension.name}</strong>
									<span data-ui="skill-row-state" data-on={extension.enabled}
										>{extension.enabled ? 'On' : 'Off'}</span
									>
								</div>
								<small data-ui="resource-detail" title={extension.path}
									>{extension.path}</small
								>
							</div>
							<div data-ui="skill-row-actions">
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
			</div>
		</details>
	{/if}
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

	.other-pi {
		margin-top: var(--space-4);
	}

	.other-pi summary {
		width: fit-content;
		color: var(--color-text-muted);
		font-size: var(--text-xs);
		cursor: pointer;
	}

	.other-pi summary:hover {
		color: var(--color-text);
	}

	.other-pi > [data-ui='settings-card'] {
		margin-top: var(--space-2);
	}
</style>
