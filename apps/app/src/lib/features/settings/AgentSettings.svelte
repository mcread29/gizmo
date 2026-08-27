<script lang="ts">
	import { onMount } from 'svelte';
	import { Puzzle } from '@lucide/svelte';
	import { Switch } from 'bits-ui';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import SettingsPage from './SettingsPage.svelte';
	import { toasts } from '../../toasts.svelte';

	let { store }: { store: AgentStore } = $props();

	// Always replace a workspace-scoped catalog with the global view on entry.
	onMount(() => void store.refreshResources());

	let catalog = $derived(store.resources);
	let agentsFiles = $derived(catalog?.agentsFiles ?? []);
	let prompts = $derived(catalog?.prompts ?? []);
	let extensions = $derived(catalog?.extensions ?? []);

	async function reloadRuntime() {
		if (await store.reloadRuntime()) {
			toasts.show(
				'Reloaded extensions, skills, prompts, and context',
				'success',
			);
		}
	}
</script>

<SettingsPage title="Agent" scope="Applies to every workspace on this machine">
	{#snippet actions()}
		<Button
			variant="secondary"
			size="sm"
			disabled={store.resourcesLoading}
			onclick={() => void store.refreshResources()}
			>{store.resourcesLoading ? 'Refreshing…' : 'Refresh catalog'}</Button
		>
		<Button
			variant="secondary"
			size="sm"
			disabled={!store.sessionId ||
				store.runtimeReloading ||
				store.sessionState === 'streaming'}
			onclick={() => void reloadRuntime()}
			>{store.runtimeReloading ? 'Reloading…' : 'Reload runtime'}</Button
		>
	{/snippet}

	{#if store.resourceError}
		<p data-ui="resource-error">{store.resourceError}</p>
	{/if}

	<div data-ui="settings-card">
		<div data-ui="settings-section-header">
			<strong>AGENTS.md</strong>
			<span>Instructions applied to every session. Edit these on disk.</span>
		</div>
		{#if agentsFiles.length === 0}
			<p data-ui="resource-empty">Nothing found.</p>
		{:else}
			<div data-ui="resource-list">
				{#each agentsFiles as resource (resource.id)}
					<div data-ui="resource-row">
						<strong>
							{resource.name}
							<em data-ui="resource-scope">{resource.scope}</em>
						</strong>
						{#if resource.description}<span>{resource.description}</span>{/if}
						<small title={resource.path}>{resource.path}</small>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div data-ui="settings-subhead">
		<strong>Extensions</strong>
		<span
			>Global Pi capabilities loaded by Gizmo and every other Pi session.
			Disable an extension without deleting it.</span
		>
	</div>

	<div data-ui="settings-card">
		{#if extensions.length === 0}
			<p data-ui="resource-empty">No global Pi extensions found.</p>
		{:else}
			<div data-ui="skill-list">
				{#each extensions as extension (extension.id)}
					<div data-ui="skill-row">
						<div data-ui="skill-row-main">
							<div data-ui="skill-row-title">
								<Puzzle size={15} />
								<strong>{extension.name}</strong>
								<span data-ui="skill-row-state" data-on={extension.enabled}
									>{extension.enabled ? 'On' : 'Off'}</span
								>
							</div>
							<small data-ui="resource-detail" title={extension.path}
								>{extension.kind} · {extension.path}</small
							>
						</div>
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
				{/each}
			</div>
		{/if}
	</div>

	<div data-ui="settings-subhead">
		<strong>Prompts</strong>
		<span>Prompt templates available as commands. Edit these on disk.</span>
	</div>

	<div data-ui="settings-card">
		{#if prompts.length === 0}
			<p data-ui="resource-empty">Nothing found.</p>
		{:else}
			<div data-ui="resource-list">
				{#each prompts as resource (resource.id)}
					<div data-ui="resource-row">
						<strong>
							{resource.name}
							<em data-ui="resource-scope">{resource.scope}</em>
						</strong>
						{#if resource.description}<span>{resource.description}</span>{/if}
						<small title={resource.path}>{resource.path}</small>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if catalog?.diagnostics.length}
		<div data-ui="settings-card">
			<div data-ui="settings-section-header">
				<strong>Warnings</strong>
				<span>Reported while loading these resources.</span>
			</div>
			<div data-ui="resource-list">
				{#each catalog.diagnostics as diagnostic, index (index)}
					<div data-ui="resource-row"><span>{diagnostic}</span></div>
				{/each}
			</div>
		</div>
	{/if}
</SettingsPage>
