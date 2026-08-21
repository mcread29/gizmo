<script lang="ts">
	import { untrack } from 'svelte';
	import { Copy, Lock, MoreHorizontal, Plus, Trash2 } from '@lucide/svelte';
	import type {
		ProjectDomains,
		ProjectSkill,
		SkillResource,
		WorkspaceIntegration,
		WorkspaceProfile,
		WorkspaceProfiles,
	} from '@unity-agent/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, ConfirmDialog, Menu, SelectField } from '../../components';
	import DomainSettings from '../../domains/DomainSettings.svelte';
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
		templates: WorkspaceProfile[];
		profiles: WorkspaceProfiles;
	};

	const toolModes = [
		{
			value: 'default',
			label: 'Pi tools only',
			hint: 'Extensions contribute no tools.',
		},
		{
			value: 'default-plus-extension',
			label: '+ extension tools',
			hint: 'Enabled extensions add their own tools alongside Pi’s.',
		},
	] as const;

	const promptModes = [
		{
			value: 'pi-default',
			label: 'Pi default',
			hint: 'The system prompt is left unchanged.',
		},
		{
			value: 'default-plus-extension-fragments',
			label: '+ extension guidance',
			hint: 'Enabled extensions append their guidance to the prompt.',
		},
	] as const;

	let project = $derived(
		store.projects.find(({ path }) => path === workspacePath),
	);
	let setup = $state<Setup>();
	/** The last saved shape, so the editor knows what is unsaved. */
	let saved = $state<string>();
	let editingId = $state<string>();
	let saving = $state(false);
	let error = $state<string>();
	let deleteOpen = $state(false);
	let removeOpen = $state(false);

	// Keyed on the workspace alone: saving replaces the stored project, and a
	// reload on every save would throw away the editor's selection.
	$effect(() => {
		const path = workspacePath;
		const selected = untrack(() =>
			store.projects.find((candidate) => candidate.path === path),
		);
		if (!selected) return;
		let current = true;
		setup = undefined;
		saved = undefined;
		error = undefined;
		void store.refreshResources(selected.path);
		void store
			.detectProject(selected.path)
			.then(({ domains, profiles }) => {
				if (!current) return;
				const stored: WorkspaceProfiles = {
					version: 1,
					activeProfileId:
						selected.activeProfileId ?? selected.profiles?.[0]?.id ?? 'default',
					profiles: selected.profiles?.length
						? selected.profiles
						: [builtinDefaultProfile()],
				};
				setup = {
					available: domains,
					templates: profiles ?? [],
					profiles: cloneProfiles(stored),
				};
				saved = JSON.stringify(setup.profiles);
				editingId = setup.profiles.activeProfileId;
			})
			.catch((cause) => {
				if (current) error = message(cause);
			});
		return () => {
			current = false;
		};
	});

	let profiles = $derived(setup?.profiles.profiles ?? []);
	let editing = $derived(
		profiles.find(({ id }) => id === editingId) ?? profiles[0],
	);
	/** Only workspace-authored profiles are editable; the rest are duplicated. */
	function isEditable(profile: WorkspaceProfile | undefined): boolean {
		return (profile?.source ?? 'workspace').startsWith('workspace');
	}
	let editable = $derived(isEditable(editing));
	let profileOptions = $derived(
		profiles.map((profile) => ({
			value: profile.id,
			label: profile.name,
			hint:
				profile.id === setup?.profiles.activeProfileId
					? 'active'
					: isEditable(profile)
						? undefined
						: 'read-only',
		})),
	);
	let dirty = $derived(
		Boolean(setup && saved && JSON.stringify(setup.profiles) !== saved),
	);
	let missingTemplates = $derived(
		(setup?.templates ?? []).filter(
			(template) => !profiles.some(({ id }) => id === template.id),
		),
	);

	/**
	 * Every profile is a set of departures from the one it starts at, so the
	 * editor states that base rather than making it another field to set: the
	 * default profile is the root, and anything else falls back to it unless it
	 * names another profile.
	 */
	let base = $derived(
		editing && editing.id !== 'default'
			? (profiles.find(({ id }) => id === (editing?.base ?? 'default')) ??
					builtinDefaultProfile())
			: undefined,
	);

	// Skills are resolved per workspace, so a stale catalog must not be shown.
	let installedSkills = $derived(
		store.resources?.workspacePath === workspacePath
			? (store.resources?.skills ?? []).filter((skill) => skill.installed)
			: [],
	);
	/**
	 * The catalog reports the *active* profile's overrides, so the rows are
	 * re-resolved against whichever profile is being edited.
	 */
	let skills = $derived(
		installedSkills.map((skill): SkillResource => {
			const override = editing?.skills?.find(({ id }) => id === skill.id);
			const { override: _ignored, ...rest } = skill;
			return {
				...rest,
				enabled: override?.enabled ?? skill.enabledGlobally,
				...(override ? { override: override.enabled } : {}),
			};
		}),
	);
	let projectSkills = $derived(skills.filter((skill) => skill.scope === 'project'));
	let globalSkills = $derived(skills.filter((skill) => skill.scope === 'global'));
	let activeSkills = $derived(skills.filter((skill) => skill.enabled).length);

	let toolsChanged = $derived(
		Boolean(base) && toolsMode(editing) !== toolsMode(base),
	);
	let promptChanged = $derived(
		Boolean(base) && promptMode(editing) !== promptMode(base),
	);
	let changedExtensions = $derived(
		new Set(
			base
				? (setup?.available ?? [])
						.map(({ id }) => id)
						.filter(
							(id) => extensionRoot(editing, id) !== extensionRoot(base, id),
						)
				: [],
		),
	);
	let changedSkills = $derived(
		new Set(
			base
				? installedSkills
						.map(({ id }) => id)
						.filter((id) => override(editing, id) !== override(base, id))
				: [],
		),
	);
	let changeCount = $derived(
		changedExtensions.size +
			changedSkills.size +
			(toolsChanged ? 1 : 0) +
			(promptChanged ? 1 : 0),
	);

	function toolsMode(profile?: WorkspaceProfile) {
		return profile?.tools?.mode ?? 'default';
	}

	function promptMode(profile?: WorkspaceProfile) {
		return profile?.prompt?.mode ?? 'pi-default';
	}

	function extensionRoot(
		profile: WorkspaceProfile | undefined,
		id: string,
	): string | undefined {
		return profile?.extensions.find((extension) => extension.id === id)?.root;
	}

	function override(
		profile: WorkspaceProfile | undefined,
		id: string,
	): boolean | undefined {
		return profile?.skills?.find((skill) => skill.id === id)?.enabled;
	}

	function setExtension(id: string, root: string | undefined) {
		if (!editing) return;
		const rest = editing.extensions.filter((extension) => extension.id !== id);
		editing.extensions =
			root === undefined ? rest : [...rest, { id, root }].sort(byId);
	}

	function toggleExtension(id: string, checked: boolean) {
		if (!setup) return;
		const detected =
			setup.available.find((candidate) => candidate.id === id)?.root ?? '.';
		setExtension(id, checked ? (extensionRoot(base, id) ?? detected) : undefined);
	}

	function setSkill(id: string, enabled: boolean | null) {
		if (!editing) return;
		const rest = (editing.skills ?? []).filter((skill) => skill.id !== id);
		editing.skills = (
			enabled === null ? rest : [...rest, { id, enabled }]
		).sort(byId);
	}

	function revertExtension(id: string) {
		setExtension(id, extensionRoot(base, id));
	}

	function revertSkill(id: string) {
		setSkill(id, override(base, id) ?? null);
	}

	function revertTools() {
		if (editing && base) editing.tools = { mode: toolsMode(base) };
	}

	function revertPrompt() {
		if (editing && base) editing.prompt = { mode: promptMode(base) };
	}

	/** One step back to the base for everything that departs from it. */
	function revertToBase() {
		if (!editing || !base) return;
		editing.extensions = base.extensions.map((extension) => ({ ...extension }));
		editing.skills = (base.skills ?? []).map((skill) => ({ ...skill }));
		editing.tools = { mode: toolsMode(base) };
		editing.prompt = { mode: promptMode(base) };
	}

	function byId(left: { id: string }, right: { id: string }) {
		return left.id.localeCompare(right.id);
	}

	function makeActive(id: string) {
		if (setup) setup.profiles.activeProfileId = id;
	}

	function addProfile(profile: WorkspaceProfile) {
		if (!setup) return;
		const added = cloneProfile({ ...profile, id: uniqueId(profile.id) });
		setup.profiles.profiles = [...profiles, added];
		editingId = added.id;
	}

	function newProfile() {
		addProfile({
			...builtinDefaultProfile(),
			id: 'custom',
			name: 'New profile',
			source: 'workspace',
			base: 'default',
		});
	}

	/** Read-only profiles are edited by duplicating them into a workspace copy. */
	function duplicateProfile() {
		if (!editing) return;
		addProfile({
			...editing,
			name: `${editing.name} copy`,
			source: 'workspace',
			base: editing.id === 'default' ? 'default' : (editing.base ?? 'default'),
		});
		// A duplicate is made to be used, so it becomes the active profile.
		if (editingId) makeActive(editingId);
	}

	function deleteProfile() {
		if (!setup || !editing) return;
		const removed = editing.id;
		const remaining = profiles.filter(({ id }) => id !== removed);
		setup.profiles.profiles = remaining;
		if (setup.profiles.activeProfileId === removed) {
			setup.profiles.activeProfileId =
				remaining.find(({ id }) => id === 'default')?.id ?? remaining[0]!.id;
		}
		editingId = setup.profiles.activeProfileId;
	}

	/** A workspace profile can be deleted; the built-in and extension ones stay. */
	let deletable = $derived(
		Boolean(editing && editable && editing.id !== 'default' && profiles.length > 1),
	);

	function uniqueId(base: string): string {
		const slug =
			base
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')
				.slice(0, 56) || 'profile';
		if (!profiles.some(({ id }) => id === slug)) return slug;
		for (let index = 2; ; index += 1) {
			const candidate = `${slug}-${index}`;
			if (!profiles.some(({ id }) => id === candidate)) return candidate;
		}
	}

	function revert() {
		if (!setup || !saved) return;
		setup.profiles = cloneProfiles(JSON.parse(saved) as WorkspaceProfiles);
		editingId = setup.profiles.activeProfileId;
		error = undefined;
	}

	async function save() {
		if (!project || !setup) return;
		const blank = profiles.find(({ name }) => !name.trim());
		if (blank) {
			error = 'Every profile needs a name.';
			return;
		}
		saving = true;
		error = undefined;
		try {
			const next = cloneProfiles(setup.profiles);
			await store.saveProjectProfiles(project.path, next);
			saved = JSON.stringify(next);
			await store.refreshResources(project.path);
		} catch (cause) {
			error = message(cause);
		} finally {
			saving = false;
		}
	}

	async function removeWorkspace() {
		if (!project) return;
		await store.removeProject(project.path);
		onRemoved();
	}

	function message(value: unknown) {
		return value instanceof Error ? value.message : String(value);
	}

	function builtinDefaultProfile(): WorkspaceProfile {
		return {
			id: 'default',
			name: 'Default',
			source: 'builtin:default',
			base: null,
			extensions: [],
			tools: { mode: 'default' },
			prompt: { mode: 'pi-default' },
		};
	}

	function cloneProfiles(input: WorkspaceProfiles): WorkspaceProfiles {
		return {
			version: 1,
			activeProfileId: input.activeProfileId,
			profiles: input.profiles.map(cloneProfile),
		};
	}

	function cloneProfile(profile: WorkspaceProfile): WorkspaceProfile {
		return {
			...profile,
			extensions: profile.extensions.map((extension): WorkspaceIntegration => ({
				...extension,
			})),
			...(profile.skills
				? {
						skills: profile.skills.map((skill): ProjectSkill => ({ ...skill })),
					}
				: {}),
		};
	}

	/** Read-only profiles carry a `builtin:`/`extension:` origin worth naming. */
	function originLabel(profile: WorkspaceProfile): string {
		if (profile.source === 'builtin:default') return 'built in';
		if (profile.source?.startsWith('extension:'))
			return `from the ${profile.source.replace(/^extension:/, '')} extension`;
		return 'provided';
	}
</script>

{#snippet revertMenu(what: string, label: string, onRevert: () => void)}
	<Menu items={[{ label: `Revert to ${label}`, onSelect: onRevert }]}>
		{#snippet trigger(props)}
			<Button
				{...props}
				variant="ghost"
				size="icon"
				aria-label={`${what} changed from ${label}`}
				><MoreHorizontal size={16} /></Button
			>
		{/snippet}
	</Menu>
{/snippet}

<div data-ui="workspace-configure">
	{#if !project}
		<p data-ui="resource-empty">No workspace is selected.</p>
	{:else if !setup || !editing}
		{#if error}<p data-ui="resource-error">{error}</p>{/if}
		<div data-ui="skeleton" data-shape="workspace-card"></div>
	{:else}
		<!-- Profile switcher: which profile this screen is configuring. -->
		<div data-ui="config-profilebar">
			<span data-ui="config-profilebar-label">Profile</span>
			<SelectField
				label="Profile being edited"
				value={editing.id}
				options={profileOptions}
				onValueChange={(id) => (editingId = id)}
			/>
			{#if !isEditable(editing)}
				<span data-ui="config-lock-chip"><Lock size={11} /> read-only</span>
			{/if}
			<Menu
				items={[
					{ label: 'New profile', onSelect: newProfile },
					...missingTemplates.map((template) => ({
						label: `Add ${template.name}`,
						onSelect: () => addProfile(template),
					})),
				]}
			>
				{#snippet trigger(props)}
					<Button {...props} size="sm" variant="ghost"
						><Plus size={14} /> New</Button
					>
				{/snippet}
			</Menu>
			<span data-ui="config-profilebar-spacer"></span>
			{#if editable}
				<Button size="sm" variant="ghost" onclick={duplicateProfile}
					><Copy size={14} /> Duplicate</Button
				>
				{#if dirty}
					<Button size="sm" variant="ghost" disabled={saving} onclick={revert}
						>Revert</Button
					>
				{/if}
				<Button size="sm" disabled={saving || !dirty} onclick={() => void save()}
					>{saving ? 'Saving…' : 'Save'}</Button
				>
			{:else}
				<Button size="sm" onclick={duplicateProfile}
					><Copy size={14} /> Duplicate to edit</Button
				>
			{/if}
		</div>

		<p data-ui="config-profilebar-note">
			{#if editable}
				Editing <strong>{editing.name}</strong>.
				{#if editing.id === setup.profiles.activeProfileId}
					New threads in this workspace use it.
				{:else}
					New threads use the active profile.
				{/if}
			{:else}
				<strong>{editing.name}</strong> is {originLabel(editing)} and read-only.
				New threads use the active profile.
			{/if}
		</p>

		{#if error}<p data-ui="resource-error">{error}</p>{/if}

		{#if !editable}
			<div data-ui="config-lock-banner">
				<Lock size={15} />
				<div>
					<strong>{editing.name}</strong> is {originLabel(editing)} and can’t be
					edited in place. Duplicate it to customize — your copy stays editable
					and keeps inheriting new defaults you don’t override.
				</div>
				<Button size="sm" onclick={duplicateProfile}
					><Copy size={14} /> Duplicate to edit</Button
				>
			</div>
		{/if}

		<!-- ZONE 1 · This profile ------------------------------------------------ -->
		<div data-ui="config-zone-heading">
			<h2>This profile</h2>
			<span>How the agent thinks and what it can do in this workspace.</span>
		</div>

		<div data-ui="workspace-configure-body" data-state={editable ? undefined : 'locked'}>
			{#if base && changeCount > 0}
				<div
					data-ui="setting-field"
					data-changed="true"
					data-ui-role="config-changes"
				>
					<div>
						<strong>{changeCount} change{changeCount === 1 ? '' : 's'} from {base.name}</strong>
						<span>Changed rows are marked.</span>
					</div>
					{#if editable}
						<Button size="sm" variant="ghost" onclick={revertToBase}
							>Revert all</Button
						>
					{/if}
				</div>
			{/if}

			<div data-ui="settings-card">
				<div data-ui="setting-field" data-state={editable ? undefined : 'disabled'}>
					<div>
						<strong>Name</strong>
						<span>Shown wherever this profile is picked.</span>
					</div>
					<input
						data-ui="text-input"
						aria-label="Profile name"
						disabled={!editable}
						value={editing.name}
						oninput={(event) => {
							if (editing) editing.name = event.currentTarget.value;
						}}
					/>
				</div>
				<div data-ui="setting-field">
					<div>
						<strong>Identifier</strong>
						<span>How the profile is referenced on disk.</span>
					</div>
					<code data-ui="profile-id">{editing.id}</code>
				</div>
				<div data-ui="setting-field">
					<div>
						<strong>Active profile</strong>
						<span>New threads in this workspace use the active profile.</span>
					</div>
					{#if editing.id === setup.profiles.activeProfileId}
						<span data-ui="connection-state" data-tone="ok"><i></i>Active</span>
					{:else}
						<Button size="sm" onclick={() => makeActive(editing.id)}
							>Make active</Button
						>
					{/if}
				</div>
			</div>

			<div data-ui="settings-subhead">
				<strong>Extensions</strong>
				<span>Which extensions this profile turns on, and where each is rooted.</span>
			</div>
			<div data-ui="settings-card">
				{#if setup.available.length === 0}
					<p data-ui="resource-empty">
						No extensions are available for this workspace.
					</p>
				{:else}
					<div data-ui="integration-list" data-layout="workspace-setup">
						{#each setup.available as extension (extension.id)}
							{@const root = extensionRoot(editing, extension.id)}
							{@const changed = changedExtensions.has(extension.id)}
							<div data-ui="integration-row" data-changed={changed || undefined}>
								<label>
									<input
										type="checkbox"
										checked={root !== undefined}
										disabled={!editable}
										onchange={(event) =>
											toggleExtension(extension.id, event.currentTarget.checked)}
									/>
									<span>
										<strong>{extension.name}</strong>
										<small
											>{extension.detected
												? 'Detected in this workspace'
												: 'Not detected'}</small
										>
									</span>
								</label>
								{#if root !== undefined && root !== '.'}
									<span
										data-ui="resource-scope"
										title={`Rooted at ${root}`}>{root}</span
									>
								{/if}
								{#if changed && base && editable}
									{@render revertMenu(extension.name, base.name, () =>
										revertExtension(extension.id),
									)}
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div data-ui="settings-subhead">
				<strong>What enabled extensions may add</strong>
				<span>Whether extensions may contribute their own tools and prompt guidance.</span>
			</div>
			<div data-ui="settings-card">
				<div data-ui="setting-field" data-changed={toolsChanged || undefined}>
					<div>
						<strong>Tools</strong>
						<span
							>{toolModes.find(({ value }) => value === toolsMode(editing))
								?.hint}</span
						>
					</div>
					<div data-ui="segmented">
						{#each toolModes as mode (mode.value)}
							<button
								type="button"
								data-ui="segmented-option"
								data-state={toolsMode(editing) === mode.value ? 'active' : undefined}
								disabled={!editable}
								onclick={() => {
									if (editing) editing.tools = { mode: mode.value };
								}}>{mode.label}</button
							>
						{/each}
					</div>
					{#if toolsChanged && base && editable}
						{@render revertMenu('Tools', base.name, revertTools)}
					{/if}
				</div>
				<div data-ui="setting-field" data-changed={promptChanged || undefined}>
					<div>
						<strong>System prompt</strong>
						<span
							>{promptModes.find(({ value }) => value === promptMode(editing))
								?.hint}</span
						>
					</div>
					<div data-ui="segmented">
						{#each promptModes as mode (mode.value)}
							<button
								type="button"
								data-ui="segmented-option"
								data-state={promptMode(editing) === mode.value ? 'active' : undefined}
								disabled={!editable}
								onclick={() => {
									if (editing) editing.prompt = { mode: mode.value };
								}}>{mode.label}</button
							>
						{/each}
					</div>
					{#if promptChanged && base && editable}
						{@render revertMenu('System prompt', base.name, revertPrompt)}
					{/if}
				</div>
			</div>

			<div data-ui="settings-subhead">
				<strong>Skills</strong>
				<span
					>{activeSkills} of {skills.length} on. Each skill uses its default until
					you change it here; install and remove skills in Settings → Agent.</span
				>
			</div>
			{#if store.resourceError}
				<p data-ui="resource-error">{store.resourceError}</p>
			{/if}
			{#if projectSkills.length > 0}
				<p data-ui="config-skill-group">From extensions · default set by the extension</p>
				<div data-ui="settings-card">
					<SkillList
						skills={projectSkills}
						mode="workspace"
						busy={!editable || store.resourcesLoading}
						changed={changedSkills}
						{...base ? { resetLabel: `Revert to ${base.name}` } : {}}
						onToggle={(skill, value) => setSkill(skill.id, value)}
						onReset={(skill) =>
							base ? revertSkill(skill.id) : setSkill(skill.id, null)}
					/>
				</div>
			{/if}
			{#if globalSkills.length > 0}
				<p data-ui="config-skill-group">Global · default is your global setting</p>
				<div data-ui="settings-card">
					<SkillList
						skills={globalSkills}
						mode="workspace"
						busy={!editable || store.resourcesLoading}
						changed={changedSkills}
						{...base ? { resetLabel: `Revert to ${base.name}` } : {}}
						onToggle={(skill, value) => setSkill(skill.id, value)}
						onReset={(skill) =>
							base ? revertSkill(skill.id) : setSkill(skill.id, null)}
					/>
				</div>
			{/if}
			{#if skills.length === 0 && !store.resourcesLoading}
				<div data-ui="settings-card">
					<p data-ui="resource-empty">No skills are installed.</p>
				</div>
			{/if}

			{#if deletable}
				<div data-ui="settings-card">
					<div data-ui="setting-field">
						<div>
							<strong>Delete this profile</strong>
							<span>Removes it from this workspace. Saved threads are untouched.</span>
						</div>
						<Button
							size="sm"
							variant="danger"
							onclick={() => (deleteOpen = true)}
							><Trash2 size={14} /> Delete profile</Button
						>
					</div>
				</div>
			{/if}
		</div>

		<!-- ZONE 2 · This workspace ---------------------------------------------- -->
		<div data-ui="config-zone-heading">
			<h2>This workspace</h2>
			<span>Applies to every profile, not just this one.</span>
		</div>

		<DomainSettings {layout} activeDomains={store.activeDomains} />

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
	bind:open={deleteOpen}
	title="Delete this profile?"
	description="The profile is removed from this workspace when you save. Existing threads keep the setup they started with."
	confirmLabel="Delete profile"
	onConfirm={deleteProfile}
/>

<ConfirmDialog
	bind:open={removeOpen}
	title="Remove this workspace?"
	description="Gizmo forgets the workspace setup and its skill overrides. Project files and existing threads are not touched."
	confirmLabel="Remove workspace"
	onConfirm={() => void removeWorkspace()}
/>
