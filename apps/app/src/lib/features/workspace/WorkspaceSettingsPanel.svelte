<script lang="ts">
	import type {
		ProjectDomains,
		SkillResource,
		WorkspaceIntegration,
		WorkspaceProfile,
		WorkspaceProfiles,
	} from '@unity-agent/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, ConfirmDialog, SelectField } from '../../components';
	import DomainSettings from '../../domains/DomainSettings.svelte';
	import SettingsPage from '../settings/SettingsPage.svelte';
	import SkillList from '../settings/SkillList.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';

	interface Props {
		layout: WorkspaceLayout;
		store: AgentStore;
		workspacePath: string;
		onRemoved: () => void;
	}

	type Setup = {
		available: ProjectDomains['domains'];
		templates: WorkspaceProfile[];
		profiles: WorkspaceProfiles;
	};

	let { layout, store, workspacePath, onRemoved }: Props = $props();

	let project = $derived(
		store.projects.find(({ path }) => path === workspacePath),
	);
	let setup = $state<Setup>();
	let saving = $state(false);
	let error = $state<string>();
	let removeOpen = $state(false);

	$effect(() => {
		if (!project) return;
		const selected = project;
		let current = true;
		setup = undefined;
		error = undefined;
		void store.refreshResources(selected.path);
		void store
			.detectProject(selected.path)
			.then(({ domains, profiles }) => {
				if (current) {
					setup = {
						available: domains,
						templates: profiles ?? [],
						profiles: cloneProfiles(
							selected.profiles
								? {
										version: 1,
										activeProfileId:
											selected.activeProfileId ??
											selected.profiles[0]?.id ??
											'default',
										profiles: selected.profiles,
									}
								: profilesFromIntegrations(
										selected.integrations,
										profiles ?? [],
										selected.skills ?? [],
									),
						),
					};
				}
			})
			.catch((cause) => {
				if (current) error = message(cause);
			});
		return () => {
			current = false;
		};
	});

	// Skills are resolved per workspace, so a stale catalog must not be shown.
	let skills = $derived(
		store.resources?.workspacePath === project?.path
			? (store.resources?.skills ?? []).filter((skill) => skill.installed)
			: [],
	);
	let activeSkills = $derived(skills.filter((skill) => skill.enabled).length);
	let activeProfile = $derived(
		setup?.profiles.profiles.find(
			({ id }) => id === setup?.profiles.activeProfileId,
		),
	);
	let missingProfileTemplates = $derived(
		(setup?.templates ?? []).filter(
			(template) =>
				!setup?.profiles.profiles.some((profile) => profile.id === template.id),
		),
	);
	let profileOptions = $derived(
		(setup?.profiles.profiles ?? []).map((profile) => ({
			value: profile.id,
			label: profile.name,
			hint: profile.source?.replace('extension:', '') ?? profile.id,
		})),
	);

	function enabled(id: string) {
		return (
			activeProfile?.extensions.some((extension) => extension.id === id) ??
			false
		);
	}

	function toggleExtension(id: string, checked: boolean) {
		if (!setup || !activeProfile) return;
		if (checked) {
			const root =
				setup.available.find((candidate) => candidate.id === id)?.root ?? '.';
			activeProfile.extensions = [...activeProfile.extensions, { id, root }];
		} else {
			activeProfile.extensions = activeProfile.extensions.filter(
				(extension) => extension.id !== id,
			);
		}
	}

	function changeRoot(id: string, root: string) {
		const integration = activeProfile?.extensions.find(
			(candidate) => candidate.id === id,
		);
		if (integration) integration.root = root;
	}

	function selectProfile(id: string) {
		if (setup) setup.profiles.activeProfileId = id;
	}

	function addProfile(template: WorkspaceProfile) {
		if (!setup) return;
		setup.profiles.profiles = [
			...setup.profiles.profiles,
			cloneProfile(template),
		];
		setup.profiles.activeProfileId = template.id;
	}

	function toggleSkill(skill: SkillResource, value: boolean) {
		if (!project) return;
		void store.setProjectSkill(project.path, skill.id, value);
	}

	function resetSkill(skill: SkillResource) {
		if (!project) return;
		void store.setProjectSkill(project.path, skill.id, null);
	}

	async function saveProfiles() {
		if (!project || !setup) return;
		saving = true;
		error = undefined;
		try {
			await store.saveProjectProfiles(
				project.path,
				cloneProfiles(setup.profiles),
			);
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

	function profilesFromIntegrations(
		integrations: WorkspaceIntegration[],
		templates: WorkspaceProfile[],
		skills: WorkspaceProfile['skills'] = [],
	): WorkspaceProfiles {
		const defaultProfile =
			templates.find(({ id }) => id === 'default') ?? builtinDefaultProfile();
		const selected =
			integrations.length === 1
				? {
						...(templates.find(({ id }) => id === integrations[0]!.id) ??
							profileFromExtensions(integrations)),
						extensions: integrations.map((extension) => ({ ...extension })),
						...(skills?.length
							? { skills: skills.map((skill) => ({ ...skill })) }
							: {}),
					}
				: integrations.length
					? profileFromExtensions(integrations, skills)
					: {
							...defaultProfile,
							...(skills?.length
								? { skills: skills.map((skill) => ({ ...skill })) }
								: {}),
						};
		return {
			version: 1,
			activeProfileId: selected.id,
			profiles: uniqueProfiles([
				cloneProfile(defaultProfile),
				...templates
					.filter(({ id }) => id !== 'default')
					.map((profile) => cloneProfile(profile)),
				cloneProfile(selected),
			]),
		};
	}

	function profileFromExtensions(
		extensions: WorkspaceIntegration[],
		skills: WorkspaceProfile['skills'] = [],
	): WorkspaceProfile {
		const id =
			extensions.map((extension) => extension.id).join('-') || 'default';
		return {
			id,
			name: id
				.split('-')
				.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
				.join(' + '),
			source: 'workspace',
			base: 'default',
			extensions: extensions.map((extension) => ({ ...extension })),
			...(skills?.length
				? { skills: skills.map((skill) => ({ ...skill })) }
				: {}),
			tools: { mode: 'default-plus-extension' },
			prompt: { mode: 'default-plus-extension-fragments' },
		};
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

	function cloneProfiles(profiles: WorkspaceProfiles): WorkspaceProfiles {
		return {
			version: 1,
			activeProfileId: profiles.activeProfileId,
			profiles: profiles.profiles.map(cloneProfile),
		};
	}

	function cloneProfile(profile: WorkspaceProfile): WorkspaceProfile {
		return {
			...profile,
			extensions: profile.extensions.map((extension) => ({ ...extension })),
			...(profile.skills
				? { skills: profile.skills.map((skill) => ({ ...skill })) }
				: {}),
		};
	}

	function uniqueProfiles(profiles: WorkspaceProfile[]): WorkspaceProfile[] {
		const unique: WorkspaceProfile[] = [];
		for (const profile of profiles) {
			const index = unique.findIndex(
				(candidate) => candidate.id === profile.id,
			);
			if (index >= 0) unique[index] = profile;
			else unique.push(profile);
		}
		return unique;
	}
</script>

<div data-ui="workspace-settings">
	{#if !project}
		<p data-ui="resource-empty">No workspace is selected.</p>
	{:else}
		{#if error}<p data-ui="resource-error">{error}</p>{/if}

		<SettingsPage title="Profiles" scope="Stored in this workspace">
			{#snippet actions()}
				<Button
					size="sm"
					disabled={saving || !setup}
					onclick={() => void saveProfiles()}
					>{saving ? 'Saving…' : 'Save'}</Button
				>
			{/snippet}
			{#if setup}
				<div data-ui="settings-card">
					<div data-ui="setting-field">
						<div>
							<strong>Active profile</strong>
							<span>New threads use this profile by default.</span>
						</div>
						<SelectField
							value={setup.profiles.activeProfileId}
							label="Active profile"
							options={profileOptions}
							onValueChange={selectProfile}
						/>
					</div>
					{#if missingProfileTemplates.length}
						<div data-ui="setting-field">
							<div>
								<strong>Add profile</strong>
								<span>Detected extensions can add project-owned profiles.</span>
							</div>
							<div data-ui="settings-actions">
								{#each missingProfileTemplates as profile (profile.id)}
									<Button size="sm" onclick={() => addProfile(profile)}
										>{profile.name}</Button
									>
								{/each}
							</div>
						</div>
					{/if}
					<div data-ui="integration-list" data-layout="workspace-setup">
						{#each setup.available as integration (integration.id)}
							<label data-ui="integration-row">
								<input
									type="checkbox"
									checked={enabled(integration.id)}
									onchange={(event) =>
										toggleExtension(
											integration.id,
											event.currentTarget.checked,
										)}
								/>
								<span>
									<strong>{integration.name}</strong>
									<small
										>{integration.detected
											? 'Detected in this workspace'
											: 'Not detected'}</small
									>
								</span>
								{#if enabled(integration.id)}
									<input
										aria-label={`${integration.name} root`}
										value={activeProfile?.extensions.find(
											({ id }) => id === integration.id,
										)?.root ?? '.'}
										oninput={(event) =>
											changeRoot(integration.id, event.currentTarget.value)}
									/>
								{/if}
							</label>
						{/each}
					</div>
				</div>
			{:else}
				<div data-ui="skeleton" data-shape="workspace-card"></div>
			{/if}
		</SettingsPage>

		<SettingsPage title="Skills" scope="Overrides for the active profile">
			{#snippet actions()}
				<span data-ui="settings-page-count"
					>{activeSkills} of {skills.length} on</span
				>
			{/snippet}
			<p data-ui="settings-note">
				Each skill follows its global setting until you change it here. Install
				and remove skills in Settings → Agent.
			</p>
			{#if store.resourceError}
				<p data-ui="resource-error">{store.resourceError}</p>
			{/if}
			<div data-ui="settings-card">
				<SkillList
					{skills}
					mode="workspace"
					busy={store.resourcesLoading}
					onToggle={toggleSkill}
					onReset={resetSkill}
				/>
			</div>
		</SettingsPage>

		<DomainSettings {layout} activeDomains={store.activeDomains} />

		<SettingsPage title="Remove" scope="Gizmo only — no files are deleted">
			<div data-ui="settings-card">
				<div data-ui="setting-field">
					<div>
						<strong>Remove this workspace</strong>
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
		</SettingsPage>
	{/if}
</div>

<ConfirmDialog
	bind:open={removeOpen}
	title="Remove this workspace?"
	description="Gizmo forgets the workspace setup and its skill overrides. Project files and existing threads are not touched."
	confirmLabel="Remove workspace"
	onConfirm={() => void removeWorkspace()}
/>
