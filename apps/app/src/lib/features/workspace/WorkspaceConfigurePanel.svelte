<script lang="ts">
	import { untrack } from 'svelte';
	import { Trash2 } from '@lucide/svelte';
	import { Switch } from 'bits-ui';
	import type { ProjectConfig, ProjectDomains } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, ConfirmDialog } from '../../components';
	import ExtensionSettings from '../../extensions/ExtensionSettings.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import SkillList from '../settings/SkillList.svelte';

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
	let removeOpen = $state(false);

	// Keyed on the workspace alone: each change re-detects to pick up the
	// stored config, so the editor always mirrors what is on disk.
	$effect(() => {
		const path = workspacePath;
		const selected = untrack(() =>
			store.projects.find((candidate) => candidate.path === path),
		);
		if (!selected) return;
		let current = true;
		setup = undefined;
		error = undefined;
		void store.refreshResources(path);
		void store.refreshToolPolicy(path);
		void store
			.detectProject(path)
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

	async function reapply(work: Promise<unknown>) {
		error = undefined;
		try {
			await work;
			const detected = await store.detectProject(workspacePath);
			setup = {
				available: detected.domains,
				config: detected.config ?? { version: 1 },
			};
			await store.refreshResources(workspacePath);
			await store.refreshProjects();
		} catch (cause) {
			error = message(cause);
		} finally {
			busyExtension = undefined;
		}
	}

	// --- Gizmo extensions: override the global toggles per workspace ---------

	function gizmoOverride(id: string): boolean | undefined {
		return setup?.config.gizmoExtensions?.find((override) => override.id === id)
			?.enabled;
	}

	function gizmoGlobal(id: string): boolean {
		return (
			store.resources?.gizmoExtensions?.find((extension) => extension.id === id)
				?.enabled ?? true
		);
	}

	/**
	 * Toggling toward the global state clears the override; only a row that
	 * actually departs from global keeps one.
	 */
	function toggleGizmoExtension(id: string, checked: boolean) {
		if (!project) return;
		busyExtension = id;
		void reapply(
			store.setProjectGizmoExtension(
				project.path,
				id,
				checked === gizmoGlobal(id) ? null : checked,
			),
		);
	}

	function resetGizmoExtension(id: string) {
		if (!project) return;
		busyExtension = id;
		void reapply(store.setProjectGizmoExtension(project.path, id, null));
	}

	// --- Pi extensions: only disabling may be overridden per workspace -------

	function piOverride(id: string): boolean | undefined {
		return setup?.config.piExtensions?.find((override) => override.id === id)
			?.enabled;
	}

	let piExtensions = $derived(store.resources?.extensions ?? []);

	function togglePiExtension(id: string, checked: boolean) {
		if (!project) return;
		busyExtension = id;
		void reapply(
			store.setProjectPiExtension(project.path, id, checked ? null : false),
		);
	}

	function resetPiExtension(id: string) {
		if (!project) return;
		busyExtension = id;
		void reapply(store.setProjectPiExtension(project.path, id, null));
	}

	// --- Skills --------------------------------------------------------------

	// Skills are resolved per workspace, so a stale catalog must not be shown.
	let installedSkills = $derived(
		store.resources?.workspacePath === workspacePath
			? (store.resources?.skills ?? []).filter((skill) => skill.installed)
			: [],
	);
	let projectSkills = $derived(
		installedSkills.filter((skill) => skill.scope === 'project'),
	);
	let globalSkills = $derived(
		installedSkills.filter((skill) => skill.scope === 'global'),
	);
	let overriddenSkills = $derived(
		new Set(
			installedSkills
				.filter((skill) => skill.override !== undefined)
				.map(({ id }) => id),
		),
	);
	let activeSkills = $derived(
		installedSkills.filter((skill) => skill.enabled).length,
	);

	function setSkill(id: string, enabled: boolean | null) {
		if (!project) return;
		void reapply(store.setProjectSkill(project.path, id, enabled));
	}

	async function removeWorkspace() {
		if (!project) return;
		await store.removeProject(project.path);
		onRemoved();
	}

	function message(value: unknown) {
		return value instanceof Error ? value.message : String(value);
	}

	let policy = $derived(store.toolPolicy);
	let overriddenTools = $derived(policy?.project ?? []);

	function toggleProjectTool(tool: string, checked: boolean) {
		if (!policy) return;
		const next = checked
			? [...overriddenTools, tool]
			: overriddenTools.filter((name) => name !== tool);
		void store.setProjectToolPolicy(workspacePath, next);
	}

	function inheritGlobalTools() {
		void store.setProjectToolPolicy(workspacePath, null);
	}

	function overrideGlobalTools() {
		if (!policy) return;
		void store.setProjectToolPolicy(
			workspacePath,
			policy.global ?? policy.effective,
		);
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

		<div data-ui="config-zone-heading">
			<h2>Gizmo extensions</h2>
			<span
				>Installed globally and on by default; each workspace can override the
				global state.</span
			>
		</div>
		<div data-ui="settings-card">
			{#if setup.available.length === 0}
				<p data-ui="resource-empty">
					No Gizmo extensions are installed globally.
				</p>
			{:else}
				<div data-ui="integration-list" data-layout="workspace-setup">
					{#each setup.available as extension (extension.id)}
						{@const override = gizmoOverride(extension.id)}
						{@const globalOn = gizmoGlobal(extension.id)}
						{@const effective = override ?? globalOn}
						<div
							data-ui="integration-row"
							data-changed={override !== undefined || undefined}
						>
							<label>
								<Switch.Root
									data-ui="switch"
									checked={effective}
									disabled={busyExtension === extension.id}
									aria-label={`${extension.name} enabled here`}
									onCheckedChange={(checked) =>
										toggleGizmoExtension(extension.id, checked)}
								>
									<Switch.Thumb data-ui="switch-thumb" />
								</Switch.Root>
								<span>
									<strong>{extension.name}</strong>
									<small>
										{override === undefined
											? `Inherits global · ${globalOn ? 'on' : 'off'}`
											: `Overridden · ${override ? 'on' : 'off'}`}
									</small>
								</span>
							</label>
							{#if override !== undefined}
								<Button
									size="sm"
									variant="ghost"
									disabled={busyExtension === extension.id}
									onclick={() => resetGizmoExtension(extension.id)}
									>Use global</Button
								>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div data-ui="config-zone-heading">
			<h2>Pi extensions</h2>
			<span
				>Enable or disable globally in Settings → Agent; a workspace can only
				turn an on extension off.</span
			>
		</div>
		<div data-ui="settings-card">
			{#if piExtensions.length === 0}
				<p data-ui="resource-empty">No global Pi extensions found.</p>
			{:else}
				<div data-ui="integration-list" data-layout="workspace-setup">
					{#each piExtensions as extension (extension.id)}
						{@const override = piOverride(extension.id)}
						{@const effective = override ?? extension.enabled}
						<div
							data-ui="integration-row"
							data-changed={override !== undefined || undefined}
						>
							<label>
								<Switch.Root
									data-ui="switch"
									checked={effective}
									disabled={!extension.enabled ||
										busyExtension === extension.id}
									aria-label={`${extension.name} enabled here`}
									onCheckedChange={(checked) =>
										togglePiExtension(extension.id, checked)}
								>
									<Switch.Thumb data-ui="switch-thumb" />
								</Switch.Root>
								<span>
									<strong>{extension.name}</strong>
									<small title={extension.path}
										>{extension.enabled
											? override === undefined
												? 'Inherits global · on'
												: 'Overridden · off'
											: 'Off globally'}</small
									>
								</span>
							</label>
							{#if override !== undefined}
								<Button
									size="sm"
									variant="ghost"
									disabled={busyExtension === extension.id}
									onclick={() => resetPiExtension(extension.id)}
									>Use global</Button
								>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div data-ui="config-zone-heading">
			<h2>Skills</h2>
			<span
				>{activeSkills} of {installedSkills.length} on. Each skill uses your global
				setting until you change it here.</span
			>
		</div>
		{#if store.resourceError}
			<p data-ui="resource-error">{store.resourceError}</p>
		{/if}
		{#if projectSkills.length > 0}
			<p data-ui="config-skill-group">
				From extensions · default set by the extension
			</p>
			<div data-ui="settings-card">
				<SkillList
					skills={projectSkills}
					mode="workspace"
					busy={store.resourcesLoading}
					changed={overriddenSkills}
					onToggle={(skill) => setSkill(skill.id, !skill.enabled)}
					onReset={(skill) => setSkill(skill.id, null)}
				/>
			</div>
		{/if}
		{#if globalSkills.length > 0}
			<p data-ui="config-skill-group">
				Global · default is your global setting
			</p>
			<div data-ui="settings-card">
				<SkillList
					skills={globalSkills}
					mode="workspace"
					busy={store.resourcesLoading}
					changed={overriddenSkills}
					onToggle={(skill) => setSkill(skill.id, !skill.enabled)}
					onReset={(skill) => setSkill(skill.id, null)}
				/>
			</div>
		{/if}
		{#if installedSkills.length === 0 && !store.resourcesLoading}
			<div data-ui="settings-card">
				<p data-ui="resource-empty">No skills are installed.</p>
			</div>
		{/if}

		<!-- Workspace-wide: built-in tools, extension settings, removal ------- -->
		<div data-ui="config-zone-heading">
			<h2>This workspace</h2>
			<span>Applies to everything the agent does here.</span>
		</div>

		<div data-ui="settings-subhead">
			<strong>Built-in tools</strong>
			<span
				>Overrides the global built-in tools for this workspace through
				.pi/settings.json.</span
			>
		</div>
		<div data-ui="settings-card">
			{#if store.toolPolicyError}
				<p data-ui="resource-error">{store.toolPolicyError}</p>
			{/if}
			{#if !policy}
				<p data-ui="resource-empty">
					{store.toolPolicyLoading ? 'Loading…' : 'Tool policy unavailable.'}
				</p>
			{:else}
				<div data-ui="setting-field">
					<div>
						<strong
							>{policy.project ? 'Overridden' : 'Inheriting global'}</strong
						>
						<span>Global: {policy.global?.join(', ') ?? 'Pi defaults'}</span>
					</div>
					{#if policy.project}
						<Button size="sm" variant="ghost" onclick={inheritGlobalTools}
							>Revert to global</Button
						>
					{:else}
						<Button size="sm" variant="ghost" onclick={overrideGlobalTools}
							>Override</Button
						>
					{/if}
				</div>
				{#if policy.project && !policy.projectApplied}
					<p data-ui="resource-error">
						This workspace is not trusted, so Pi ignores this override.
					</p>
				{/if}
				{#if policy.project}
					<div data-ui="integration-list">
						{#each policy.builtIn as tool (tool)}
							<div data-ui="integration-row">
								<label>
									<input
										type="checkbox"
										checked={overriddenTools.includes(tool)}
										disabled={store.toolPolicyLoading}
										onchange={(event) =>
											toggleProjectTool(tool, event.currentTarget.checked)}
									/>
									<span>
										<strong>{tool}</strong>
									</span>
								</label>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<ExtensionSettings {layout} activeDomains={store.activeDomains} />

		<div data-ui="settings-card">
			<div data-ui="setting-field">
				<div>
					<strong>Remove workspace from Gizmo</strong>
					<span
						>Gizmo forgets its setup and skill overrides. Project files and
						existing threads are untouched.</span
					>
				</div>
				<Button variant="danger" size="sm" onclick={() => (removeOpen = true)}
					>Remove</Button
				>
			</div>
		</div>
	{/if}
</div>

<ConfirmDialog
	bind:open={removeOpen}
	title="Remove this workspace?"
	description="Gizmo forgets the workspace setup and its skill overrides. Project files and existing threads are not touched."
	confirmLabel="Remove workspace"
	onConfirm={() => void removeWorkspace()}
/>
