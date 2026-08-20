<script lang="ts">
	import { ArrowLeft, FolderOpen } from '@lucide/svelte';
	import type {
		ProjectDomains,
		SkillResource,
		WorkspaceIntegration,
	} from '@unity-agent/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, ConfirmDialog, ScrollPanel } from '../../components';
	import DomainSettings from '../../domains/DomainSettings.svelte';
	import SettingsPage from '../settings/SettingsPage.svelte';
	import SkillList from '../settings/SkillList.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';

	interface Props {
		open?: boolean;
		layout: WorkspaceLayout;
		store: AgentStore;
		onClose: () => void;
	}

	type Setup = {
		available: ProjectDomains['domains'];
		integrations: WorkspaceIntegration[];
	};

	let { open = false, layout, store, onClose }: Props = $props();

	let project = $derived(
		store.projects.find(({ path }) => path === store.selectedProjectPath),
	);
	let setup = $state<Setup>();
	let saving = $state(false);
	let error = $state<string>();
	let removeOpen = $state(false);
	let backButton = $state<HTMLButtonElement>();

	$effect(() => {
		if (open) backButton?.focus();
	});

	$effect(() => {
		if (!open || !project) return;
		const selected = project;
		let current = true;
		setup = undefined;
		error = undefined;
		void store.refreshResources(selected.path);
		void store
			.detectProject(selected.path)
			.then(({ domains }) => {
				if (current) {
					setup = {
						available: domains,
						integrations: selected.integrations.map((integration) => ({
							...integration,
						})),
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

	function enabled(id: string) {
		return (
			setup?.integrations.some((integration) => integration.id === id) ?? false
		);
	}

	function toggleIntegration(id: string, checked: boolean) {
		if (!setup) return;
		if (checked) {
			const root =
				setup.available.find((candidate) => candidate.id === id)?.root ?? '.';
			setup.integrations = [...setup.integrations, { id, root }];
		} else {
			setup.integrations = setup.integrations.filter(
				(integration) => integration.id !== id,
			);
		}
	}

	function changeRoot(id: string, root: string) {
		const integration = setup?.integrations.find(
			(candidate) => candidate.id === id,
		);
		if (integration) integration.root = root;
	}

	function toggleSkill(skill: SkillResource, value: boolean) {
		if (!project) return;
		void store.setProjectSkill(project.path, skill.id, value);
	}

	function resetSkill(skill: SkillResource) {
		if (!project) return;
		void store.setProjectSkill(project.path, skill.id, null);
	}

	async function saveIntegrations() {
		if (!project || !setup) return;
		saving = true;
		error = undefined;
		try {
			await store.addProject(project.path, setup.integrations);
		} catch (cause) {
			error = message(cause);
		} finally {
			saving = false;
		}
	}

	async function removeWorkspace() {
		if (!project) return;
		await store.removeProject(project.path);
		onClose();
	}

	function message(value: unknown) {
		return value instanceof Error ? value.message : String(value);
	}
</script>

{#if open}
	<section data-ui="settings-screen" aria-label="Workspace settings">
		<header data-ui="settings-screen-header">
			<button bind:this={backButton} data-ui="settings-back" onclick={onClose}>
				<ArrowLeft size={15} />
				<span>Back</span>
			</button>
			<h1>{project?.title ?? 'Workspace'}</h1>
			{#if project}
				<span data-ui="workspace-path"
					><FolderOpen size={14} />{project.path}</span
				>
			{/if}
		</header>

		<ScrollPanel>
			<div data-ui="settings-content">
				{#if !project}
					<p data-ui="resource-empty">No workspace is selected.</p>
				{:else}
					{#if error}<p data-ui="resource-error">{error}</p>{/if}

					<SettingsPage
						title="Integrations"
						scope="Applies to this workspace only"
					>
						{#snippet actions()}
							<Button
								size="sm"
								disabled={saving || !setup}
								onclick={() => void saveIntegrations()}
								>{saving ? 'Saving…' : 'Save'}</Button
							>
						{/snippet}
						{#if setup}
							<div data-ui="settings-card">
								<div data-ui="integration-list" data-layout="workspace-setup">
									{#each setup.available as integration (integration.id)}
										<label data-ui="integration-row">
											<input
												type="checkbox"
												checked={enabled(integration.id)}
												onchange={(event) =>
													toggleIntegration(
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
													value={setup.integrations.find(
														({ id }) => id === integration.id,
													)?.root ?? '.'}
													oninput={(event) =>
														changeRoot(
															integration.id,
															event.currentTarget.value,
														)}
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

					<SettingsPage title="Skills" scope="Overrides for this workspace">
						{#snippet actions()}
							<span data-ui="settings-page-count"
								>{activeSkills} of {skills.length} on</span
							>
						{/snippet}
						<p data-ui="settings-note">
							Each skill follows its global setting until you change it here.
							Install and remove skills in Settings → Agent.
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

					<SettingsPage
						title="Remove"
						scope="Gizmo only — no files are deleted"
					>
						<div data-ui="settings-card">
							<div data-ui="setting-field">
								<div>
									<strong>Remove this workspace</strong>
									<span
										>Gizmo forgets its setup and skill overrides. Project files
										and existing threads are untouched.</span
									>
								</div>
								<Button
									variant="danger"
									size="sm"
									onclick={() => (removeOpen = true)}>Remove</Button
								>
							</div>
						</div>
					</SettingsPage>
				{/if}
			</div>
		</ScrollPanel>
	</section>

	<ConfirmDialog
		bind:open={removeOpen}
		title="Remove this workspace?"
		description="Gizmo forgets the workspace setup and its skill overrides. Project files and existing threads are not touched."
		confirmLabel="Remove workspace"
		onConfirm={() => void removeWorkspace()}
	/>
{/if}
