<script lang="ts">
	import type { ProjectConfig, ProjectDomains } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import ExtensionSettings from '../../extensions/ExtensionSettings.svelte';
	import InstructionsEditor from '../settings/InstructionsEditor.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import ConfigureSectionHeading from './configure/ConfigureSectionHeading.svelte';
	import GizmoExtensionOverridesSection from './configure/GizmoExtensionOverridesSection.svelte';
	import PiExtensionOverridesSection from './configure/PiExtensionOverridesSection.svelte';
	import RemoveWorkspaceSection from './configure/RemoveWorkspaceSection.svelte';
	import WorkspaceSkillsSection from './configure/WorkspaceSkillsSection.svelte';
	import WorkspaceToolPolicySection from './configure/WorkspaceToolPolicySection.svelte';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
		workspacePath: string;
		onRemoved: () => void;
	}

	let { store, layout, workspacePath, onRemoved }: Props = $props();

	type Setup = {
		available: ProjectDomains['domains'];
		config: ProjectConfig;
	};

	let project = $derived(
		store.projects.find(({ path }) => path === workspacePath),
	);
	let setup = $state<Setup>();
	let error = $state<string>();
	let busyExtension = $state<string>();

	// Re-runs when the workspace appears or disappears from the catalog (and
	// when its path prop changes), then loads its configuration once per
	// registration. The project lookup must stay tracked: an untracked read
	// with an early return left the screen permanently blank whenever this ran
	// before the catalog loaded, because the effect never re-fired.
	$effect(() => {
		const registered = store.projects.some(
			({ path }) => path === workspacePath,
		);
		if (!registered) return;
		let current = true;
		setup = undefined;
		error = undefined;
		void store.refreshResources(workspacePath);
		void store.refreshToolPolicy(workspacePath);
		void store
			.detectProject(workspacePath)
			.then(({ domains, config }) => {
				if (current)
					setup = { available: domains, config: config ?? { version: 1 } };
			})
			.catch((cause) => {
				if (current) error = message(cause);
			});
		return () => {
			current = false;
		};
	});

	/**
	 * Applies one change without touching anything else: the server returns
	 * the stored config and it is merged in place, so only the rows it affects
	 * re-render. Replacing catalogs or the setup object here would flash and
	 * reflow the screen on every toggle.
	 */
	async function reapply(work: Promise<ProjectConfig | void>) {
		error = undefined;
		try {
			const config = await work;
			if (config && setup) setup.config = config;
		} catch (cause) {
			error = message(cause);
		} finally {
			busyExtension = undefined;
		}
	}

	function message(value: unknown) {
		return value instanceof Error ? value.message : String(value);
	}
</script>

<div data-ui="workspace-configure">
	{#if !project}
		<p data-ui="resource-empty">No workspace is selected.</p>
	{:else if !setup}
		{#if error}<p data-ui="resource-error">{error}</p>{/if}
		<div data-ui="skeleton" data-shape="workspace-card"></div>
	{:else}
		<p data-ui="config-intro-note">
			This workspace follows your global settings. Turn something on or off here
			to override it for this workspace only; clearing the override follows
			global again.
		</p>

		{#if error}<p data-ui="resource-error">{error}</p>{/if}

		<GizmoExtensionOverridesSection
			{store}
			workspacePath={project.path}
			available={setup.available}
			config={setup.config}
			{busyExtension}
			onBusy={(id) => (busyExtension = id)}
			onReapply={(work) => void reapply(work)}
		/>

		<PiExtensionOverridesSection
			{store}
			workspacePath={project.path}
			config={setup.config}
			{busyExtension}
			onBusy={(id) => (busyExtension = id)}
			onReapply={(work) => void reapply(work)}
		/>

		<WorkspaceSkillsSection
			{store}
			workspacePath={project.path}
			onReapply={(work) => void reapply(work)}
		/>

		<!-- Workspace-wide: built-in tools, extension settings, removal. -->
		<ConfigureSectionHeading
			title="This workspace"
			description="Applies to everything the agent does here."
		/>
		<InstructionsEditor
			{store}
			target="project-agents"
			workspacePath={project.path}
			title="AGENTS.md"
			description="Instructions for every session in this workspace, alongside the global AGENTS.md. Takes effect for new threads or after Reload runtime."
		/>
		<WorkspaceToolPolicySection {store} {workspacePath} />
		<ExtensionSettings
			{layout}
			enabledExtensionIds={store.enabledExtensionIds}
		/>
		<RemoveWorkspaceSection {store} workspacePath={project.path} {onRemoved} />
	{/if}
</div>
