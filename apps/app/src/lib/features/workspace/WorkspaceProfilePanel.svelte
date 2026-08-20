<script lang="ts">
	import { untrack } from 'svelte';
	import { Check, Copy, MoreHorizontal, Plus, Trash2 } from '@lucide/svelte';
	import type {
		ProjectDomains,
		ProjectSkill,
		SkillResource,
		WorkspaceIntegration,
		WorkspaceProfile,
		WorkspaceProfiles,
	} from '@unity-agent/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, ConfirmDialog, Menu } from '../../components';
	import SettingsPage from '../settings/SettingsPage.svelte';
	import SkillList from '../settings/SkillList.svelte';

	interface Props {
		store: AgentStore;
		workspacePath: string;
	}

	let { store, workspacePath }: Props = $props();

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
			label: 'Pi tools + extensions',
			hint: 'Enabled extensions add their own tools.',
		},
	] as const;

	const promptModes = [
		{
			value: 'pi-default',
			label: "Pi's default prompt",
			hint: 'The system prompt is left unchanged.',
		},
		{
			value: 'default-plus-extension-fragments',
			label: 'Default + extension fragments',
			hint: 'Enabled extensions append their guidance.',
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
		setExtension(
			id,
			checked ? (extensionRoot(base, id) ?? detected) : undefined,
		);
	}

	function changeRoot(id: string, root: string) {
		const extension = editing?.extensions.find(
			(candidate) => candidate.id === id,
		);
		if (extension) extension.root = root;
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

	function duplicateProfile() {
		if (!editing) return;
		addProfile({
			...editing,
			name: `${editing.name} copy`,
			source: 'workspace',
			base: editing.id === 'default' ? 'default' : (editing.base ?? 'default'),
		});
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

	/** `default` is what every other profile falls back to, so it stays. */
	let deletable = $derived(
		Boolean(editing && editing.id !== 'default' && profiles.length > 1),
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

	function sourceLabel(profile: WorkspaceProfile): string {
		if (!profile.source) return profile.id;
		return profile.source.replace(/^(builtin|extension):/, '');
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

<div data-ui="workspace-profile">
	{#if !project}
		<p data-ui="resource-empty">No workspace is selected.</p>
	{:else if !setup || !editing}
		{#if error}<p data-ui="resource-error">{error}</p>{/if}
		<div data-ui="skeleton" data-shape="workspace-card"></div>
	{:else}
		<SettingsPage
			title="Profile"
			scope={dirty
				? 'Unsaved — stored in this workspace'
				: 'Stored in this workspace'}
		>
			{#snippet actions()}
				{#if dirty}
					<Button size="sm" variant="ghost" disabled={saving} onclick={revert}
						>Revert</Button
					>
				{/if}
				<Button
					size="sm"
					disabled={saving || !dirty}
					onclick={() => void save()}>{saving ? 'Saving…' : 'Save'}</Button
				>
			{/snippet}

			{#if error}<p data-ui="resource-error">{error}</p>{/if}

			<div data-ui="profile-editor">
				<div data-ui="profile-list">
					{#each profiles as profile (profile.id)}
						<button
							type="button"
							data-ui="profile-entry"
							data-state={profile.id === editing.id ? 'selected' : undefined}
							onclick={() => (editingId = profile.id)}
						>
							<span>
								<strong>{profile.name}</strong>
								<small>{sourceLabel(profile)}</small>
							</span>
							{#if profile.id === setup.profiles.activeProfileId}
								<em data-ui="profile-active-pill"><Check size={11} />Active</em>
							{/if}
						</button>
					{/each}
					<div data-ui="profile-list-actions">
						<Button size="sm" variant="ghost" onclick={newProfile}
							><Plus size={14} /> New profile</Button
						>
						<Button size="sm" variant="ghost" onclick={duplicateProfile}
							><Copy size={14} /> Duplicate</Button
						>
						{#each missingTemplates as template (template.id)}
							<Button
								size="sm"
								variant="ghost"
								onclick={() => addProfile(template)}
								><Plus size={14} /> {template.name}</Button
							>
						{/each}
					</div>
				</div>

				<div data-ui="profile-detail">
					<div data-ui="settings-card">
						<div data-ui="setting-field">
							<div>
								<strong>Name</strong>
								<span>Shown wherever this profile is picked.</span>
							</div>
							<input
								data-ui="text-input"
								aria-label="Profile name"
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
								<span
									>New threads in this workspace use the active profile.</span
								>
							</div>
							{#if editing.id === setup.profiles.activeProfileId}
								<span data-ui="connection-state" data-tone="ok"
									><i></i>Active</span
								>
							{:else}
								<Button size="sm" onclick={() => makeActive(editing.id)}
									>Make active</Button
								>
							{/if}
						</div>
						{#if base}
							<div data-ui="setting-field" data-changed={changeCount > 0}>
								<div>
									<strong>Starts from {base.name}</strong>
									<span
										>{changeCount
											? `${changeCount} setting${changeCount === 1 ? '' : 's'} changed from ${base.name}. Changed rows are marked.`
											: `Identical to ${base.name} so far.`}</span
									>
								</div>
								{#if changeCount}
									<Button size="sm" variant="ghost" onclick={revertToBase}
										>Revert all</Button
									>
								{/if}
							</div>
						{/if}
					</div>

					<div data-ui="settings-subhead">
						<strong>Extensions</strong>
						<span
							>Which detected extensions this profile turns on, and where each
							one is rooted.</span
						>
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
									<div
										data-ui="integration-row"
										data-changed={changed || undefined}
									>
										<label>
											<input
												type="checkbox"
												checked={root !== undefined}
												onchange={(event) =>
													toggleExtension(
														extension.id,
														event.currentTarget.checked,
													)}
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
										{#if root !== undefined}
											<input
												aria-label={`${extension.name} root`}
												value={root}
												oninput={(event) =>
													changeRoot(extension.id, event.currentTarget.value)}
											/>
										{/if}
										{#if changed && base}
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
						<strong>Tools and prompt</strong>
						<span>What an extension is allowed to contribute to a thread.</span>
					</div>
					<div data-ui="settings-card">
						<div
							data-ui="setting-field"
							data-changed={toolsChanged || undefined}
						>
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
										data-state={toolsMode(editing) === mode.value
											? 'active'
											: undefined}
										onclick={() => {
											if (editing) editing.tools = { mode: mode.value };
										}}>{mode.label}</button
									>
								{/each}
							</div>
							{#if toolsChanged && base}
								{@render revertMenu('Tools', base.name, revertTools)}
							{/if}
						</div>
						<div
							data-ui="setting-field"
							data-changed={promptChanged || undefined}
						>
							<div>
								<strong>System prompt</strong>
								<span
									>{promptModes.find(
										({ value }) => value === promptMode(editing),
									)?.hint}</span
								>
							</div>
							<div data-ui="segmented">
								{#each promptModes as mode (mode.value)}
									<button
										type="button"
										data-ui="segmented-option"
										data-state={promptMode(editing) === mode.value
											? 'active'
											: undefined}
										onclick={() => {
											if (editing) editing.prompt = { mode: mode.value };
										}}>{mode.label}</button
									>
								{/each}
							</div>
							{#if promptChanged && base}
								{@render revertMenu('System prompt', base.name, revertPrompt)}
							{/if}
						</div>
					</div>

					<div data-ui="settings-subhead">
						<strong>Skills</strong>
						<span
							>{activeSkills} of {skills.length} on for this profile. Each skill follows
							its global setting until you change it here; install and remove skills
							in Settings → Agent.</span
						>
					</div>
					{#if store.resourceError}
						<p data-ui="resource-error">{store.resourceError}</p>
					{/if}
					<div data-ui="settings-card">
						<SkillList
							{skills}
							mode="workspace"
							busy={store.resourcesLoading}
							changed={changedSkills}
							{...base ? { resetLabel: `Revert to ${base.name}` } : {}}
							onToggle={(skill, value) => setSkill(skill.id, value)}
							onReset={(skill) =>
								base ? revertSkill(skill.id) : setSkill(skill.id, null)}
						/>
					</div>

					<div data-ui="settings-card">
						<div data-ui="setting-field">
							<div>
								<strong>This profile</strong>
								<span
									>{deletable
										? 'Deleting it leaves saved threads untouched.'
										: 'The default profile is what every other profile falls back to, so it cannot be deleted.'}</span
								>
							</div>
							<Button
								size="sm"
								variant="danger"
								disabled={!deletable}
								onclick={() => (deleteOpen = true)}
								><Trash2 size={14} /> Delete profile</Button
							>
						</div>
					</div>
				</div>
			</div>
		</SettingsPage>
	{/if}
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete this profile?"
	description="The profile is removed from this workspace when you save. Existing threads keep the setup they started with."
	confirmLabel="Delete profile"
	onConfirm={deleteProfile}
/>
