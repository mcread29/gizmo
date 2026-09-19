<script lang="ts">
	import { GitBranch, Link2, RefreshCw } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote } from '../../components';

	let { store }: { store: AgentStore } = $props();

	let registry = $derived(store.registryStatus);
	let available = $derived(
		registry?.extensions.filter(({ linked }) => !linked) ?? [],
	);
</script>

{#if !registry}
	<div data-ui="settings-card">
		<ResourceNote>Loading…</ResourceNote>
	</div>
{:else}
	<div data-ui="settings-card">
		<div data-ui="setting-field">
			<div>
				<strong><GitBranch size={13} /> {registry.url}</strong>
				<span data-ui="resource-detail"
					>{registry.commit ?? 'No commit recorded yet'}</span
				>
			</div>
			{#if registry.updateAvailable}
				<Button
					variant="secondary"
					size="sm"
					disabled={store.registryBusy}
					onclick={() => void store.registryUpdate()}
				>
					<RefreshCw size={13} /> Update
				</Button>
			{/if}
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
						onclick={() => void store.registryLink(extension.id)}
					>
						<Link2 size={13} /> Install
					</Button>
				</div>
			{:else}
				<ResourceNote>
					{registry.extensions.length === 0
						? 'No extensions in the registry.'
						: 'Everything in the registry is already installed — manage it above.'}
				</ResourceNote>
			{/each}
		</div>
	</div>
{/if}

<style>
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
