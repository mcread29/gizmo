<script lang="ts">
	import { onMount } from 'svelte';
	import { RefreshCw, Download, Trash2, GitBranch } from '@lucide/svelte';
	import type { RegistryExtensionStatus } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	let url = $state('');

	onMount(() => {
		void store.refreshRegistry();
	});

	let installed = $derived(store.registryStatus?.installed ?? []);

	async function install(event: SubmitEvent) {
		event.preventDefault();
		if (!url.trim()) return;
		const done = await store.registryInstall(url.trim());
		if (done) url = '';
	}

	async function update(extension: RegistryExtensionStatus) {
		await store.registryUpdate(extension.name);
	}

	async function remove(extension: RegistryExtensionStatus) {
		await store.registryRemove(extension.name);
	}
</script>

<SettingsPage
	title="Extensions"
	scope="Git-hosted Pi extensions, cloned locally and linked into Pi"
>
	<p data-ui="resource-detail">
		Extensions are git repositories cloned to
		<code>{store.registryStatus?.home ?? '…'}</code> and built locally. A repo's
		<code>gizmo.registry.json</code> may declare a build command and the directory
		its extensions live in.
	</p>

	{#if store.registryError}
		<p data-ui="resource-error">{store.registryError}</p>
	{/if}

	<div data-ui="settings-subhead">
		<strong>Install from git URL</strong>
		<span
			>Clones the repository, builds it, and links its extensions into Pi.</span
		>
	</div>
	<div data-ui="settings-card">
		<form class="registry-install" onsubmit={install}>
			<input
				data-ui="text-input"
				placeholder="https://github.com/you/pi-extensions.git"
				bind:value={url}
				disabled={store.registryBusy}
				aria-label="Extension repository URL"
			/>
			<Button type="submit" disabled={store.registryBusy || !url.trim()}>
				<Download size={14} /> Install
			</Button>
		</form>
	</div>

	<div data-ui="settings-subhead">
		<strong>Installed registries</strong>
		<span>Each entry is one cloned repository and the extensions it links.</span
		>
	</div>

	{#if store.registryBusy && installed.length === 0}
		<div data-ui="settings-card">
			<p data-ui="resource-empty">Loading…</p>
		</div>
	{:else if installed.length === 0}
		<div data-ui="settings-card">
			<p data-ui="resource-empty">
				Nothing installed yet. Paste a repository URL above to install your
				first extensions.
			</p>
		</div>
	{:else}
		{#each installed as registry (registry.name)}
			<div data-ui="settings-card">
				<div data-ui="setting-field">
					<div>
						<strong>
							<GitBranch size={13} />
							{registry.name}
						</strong>
						<span data-ui="resource-detail" title={registry.url}
							>{registry.url}{registry.commit
								? ` · ${registry.commit}`
								: ''}</span
						>
					</div>
					<div class="registry-actions">
						<Button
							variant="secondary"
							size="sm"
							disabled={store.registryBusy}
							onclick={() => void update(registry)}
						>
							<RefreshCw size={13} /> Update
						</Button>
						<Button
							variant="danger"
							size="sm"
							disabled={store.registryBusy}
							onclick={() => void remove(registry)}
						>
							<Trash2 size={13} /> Remove
						</Button>
					</div>
				</div>
				<div data-ui="integration-list">
					{#each registry.extensions as extension (extension.id)}
						<div data-ui="integration-row">
							<span>
								<strong>{extension.id}</strong>
								<small
									data-ui="resource-detail"
									title={extension.web ?? extension.entry}
								>
									{extension.web ? 'tool + UI' : 'tool'}
								</small>
							</span>
						</div>
					{:else}
						<p data-ui="resource-empty">No extensions synced from this repo.</p>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</SettingsPage>

<style>
	.registry-install {
		display: flex;
		gap: var(--space-2);
	}

	.registry-install [data-ui='text-input'] {
		flex: 1;
		width: auto;
	}

	.registry-actions {
		display: flex;
		gap: var(--space-2);
	}
</style>
