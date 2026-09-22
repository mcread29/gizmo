<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import ExtensionSettings from '../../extensions/ExtensionSettings.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import GizmoExtensionOverridesSection from './configure/GizmoExtensionOverridesSection.svelte';
	import PiExtensionOverridesSection from './configure/PiExtensionOverridesSection.svelte';
	import ProjectExtensionPathsSection from './configure/ProjectExtensionPathsSection.svelte';
	import WorkspaceExtensionsSection from './configure/WorkspaceExtensionsSection.svelte';
	import type { WorkspaceConfiguration } from './workspace-config.svelte';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
		workspacePath: string;
		configuration: WorkspaceConfiguration;
	}

	let { store, layout, workspacePath, configuration }: Props = $props();

	let config = $derived(configuration.config ?? { version: 1 as const });
	// Domains with no matching Pi extension are leftovers from the retired
	// profile system. Nothing on a current install has any, so the section only
	// appears where an old config still names one.
	let legacyExtensions = $derived(
		configuration.domains.filter(
			({ id }) =>
				!store.resources?.extensions?.some((extension) => extension.id === id),
		),
	);
</script>

{#if legacyExtensions.length}
	<GizmoExtensionOverridesSection
		{store}
		{workspacePath}
		available={legacyExtensions}
		{config}
		busyExtension={configuration.busyExtension}
		onBusy={(id) => (configuration.busyExtension = id)}
		onReapply={(work) => void configuration.reapply(work)}
	/>
{/if}

<PiExtensionOverridesSection
	{store}
	{workspacePath}
	{config}
	busyExtension={configuration.busyExtension}
	onBusy={(id) => (configuration.busyExtension = id)}
	onReapply={(work) => void configuration.reapply(work)}
/>

<WorkspaceExtensionsSection
	{store}
	{workspacePath}
	{config}
	found={configuration.workspaceExtensions}
	onReapply={(work) => void configuration.reapply(work)}
	onRescan={() =>
		configuration.refreshWorkspaceExtensions(store, workspacePath)}
/>

<ProjectExtensionPathsSection
	{store}
	{workspacePath}
	{config}
	found={configuration.workspaceExtensions}
	onReapply={(work) => void configuration.reapply(work)}
/>

<section data-ui="settings-subhead">
	<h3>Extension settings</h3>
	<span>These settings are global: every workspace and client shares them.</span
	>
</section>
{#each store.enabledExtensionIds as extensionId (extensionId)}
	<ExtensionSettings {store} {extensionId} />
{/each}
