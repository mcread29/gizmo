<script lang="ts">
	import { onMount } from 'svelte';
	import {
		RefreshCw,
		Download,
		Trash2,
		GitBranch,
		Link2,
		Unlink2,
	} from '@lucide/svelte';
	import type { RegistryInfo } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	let url = $state('');

	onMount(() => {
		void store.refreshRegistry();
	});

	let registries = $derived(store.registryStatus?.registries ?? []);

	async function add(event: SubmitEvent) {
		event.preventDefault();
		if (!url.trim()) return;
		const done = await store.registryAdd(url.trim());
		if (done) url = '';
	}

	async function update(registry: RegistryInfo) {
		await store.registryUpdate(registry.name);
	}

	async function remove(registry: RegistryInfo) {
		await store.registryRemove(registry.name);
	}

	async function toggle(
		registry: RegistryInfo,
		extension: { id: string; linked: boolean },
	) {
		if (extension.linked) {
			await store.registryUnlink(registry.name, extension.id);
		} else {
			await store.registryLink(registry.name, extension.id);
		}
	}
</script>

<SettingsPage
	title="Extensions"
	scope="Git registries cloned locally; linking installs an extension into Pi"
>
	<p data-ui="resource-detail">
		Extensions live in git registries. Adding a registry clones it to
		<code>{store.registryStatus?.home ?? '…'}</code>; linking an extension
		copies it and its UI into Pi's extensions directory.
	</p>

	{#if store.registryError}
		<p data-ui="resource-error">{store.registryError}</p>
	{/if}

	<div data-ui="settings-subhead">
		<strong>Add a registry</strong>
		<span
			>A git URL whose <code>gizmo.registry.json</code> lists its extensions.</span
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
				<Download size={14} /> Add
			</Button>
		</form>
	</div>

	{#if store.registryBusy && registries.length === 0}
		<div data-ui="settings-card">
			<p data-ui="resource-empty">Loading…</p>
		</div>
	{:else if registries.length === 0}
		<div data-ui="settings-card">
			<p data-ui="resource-empty">
				No registries added yet. Gizmo ships without extensions — add one above
				to install tools and their UI.
			</p>
		</div>
	{/if}

	{#each registries as registry (registry.name)}
		<div data-ui="settings-card">
			<div data-ui="setting-field">
				<div>
					<strong><GitBranch size={13} /> {registry.name}</strong>
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
					<div
						data-ui="integration-row"
						data-changed={extension.linked || undefined}
					>
						<span>
							<strong>{extension.name}</strong>
							{#if extension.description}
								<small data-ui="resource-detail">{extension.description}</small>
							{/if}
						</span>
						<Button
							variant={extension.linked ? 'ghost' : 'secondary'}
							size="sm"
							disabled={store.registryBusy}
							onclick={() => void toggle(registry, extension)}
						>
							{#if extension.linked}<Unlink2 size={13} /> Unlink{:else}
								<Link2 size={13} /> Install{/if}
						</Button>
					</div>
				{:else}
					<p data-ui="resource-empty">No extensions in this registry.</p>
				{/each}
			</div>
		</div>
	{/each}
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

	.registry-actions {
		display: flex;
		gap: var(--space-2);
	}

	/*
	 * integration-row's shared grid reserves a middle 1fr spacer plus a
	 * minmax(100px, 180px) action column for the configure screen's switch
	 * and revert layout. These rows only have a name span and an action, so
	 * collapse to two columns and pin the action to the row's right edge.
	 */
	[data-ui='integration-row'] {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	[data-ui='integration-row'] > :global([data-ui='button']) {
		justify-self: end;
	}
</style>
