<script lang="ts">
	import { GitBranch, Link2, RefreshCw, Trash2 } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote } from '../../components';

	let { store }: { store: AgentStore } = $props();

	let registries = $derived(store.registryStatus?.registries ?? []);

	async function update(name: string) {
		await store.registryUpdate(name);
	}

	async function remove(name: string) {
		await store.registryRemove(name);
	}
</script>

<div data-ui="settings-subhead">
	<strong>Registries</strong>
	<span>Update sources, manage installed extensions, or remove a registry.</span
	>
</div>

{#if store.registryBusy && registries.length === 0}
	<div data-ui="settings-card">
		<ResourceNote>Loading…</ResourceNote>
	</div>
{:else if registries.length === 0}
	<div data-ui="settings-card">
		<ResourceNote>
			No registries added yet. Gizmo ships without extensions — add one above to
			install tools and their UI.
		</ResourceNote>
	</div>
{/if}

{#each registries as registry (registry.name)}
	{@const available = registry.extensions.filter((ext) => !ext.linked)}
	<div data-ui="settings-card">
		<div data-ui="setting-field">
			<div>
				<strong><GitBranch size={13} /> {registry.name}</strong>
				<span data-ui="resource-detail" title={registry.url}
					>{registry.url}{registry.commit ? ` · ${registry.commit}` : ''}</span
				>
			</div>
			<div class="registry-actions">
				{#if registry.updateAvailable}
					<Button
						variant="secondary"
						size="sm"
						disabled={store.registryBusy}
						onclick={() => void update(registry.name)}
					>
						<RefreshCw size={13} /> Update
					</Button>
				{/if}
				<Button
					variant="danger"
					size="sm"
					disabled={store.registryBusy}
					onclick={() => void remove(registry.name)}
				>
					<Trash2 size={13} /> Remove
				</Button>
			</div>
		</div>

		<div data-ui="integration-list">
			{#each available as extension (extension.id)}
				<div data-ui="integration-row">
					<span>
						<strong>{extension.name}</strong>
						{#if extension.description}
							<small data-ui="resource-detail">{extension.description}</small>
						{/if}
					</span>
					<Button
						variant="secondary"
						size="sm"
						disabled={store.registryBusy}
						onclick={() => void store.registryLink(registry.name, extension.id)}
					>
						<Link2 size={13} /> Install
					</Button>
				</div>
			{:else}
				<ResourceNote>
					{registry.extensions.length === 0
						? 'No extensions in this registry.'
						: 'Everything in this registry is already installed — manage it above.'}
				</ResourceNote>
			{/each}
		</div>
	</div>
{/each}

<style>
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
