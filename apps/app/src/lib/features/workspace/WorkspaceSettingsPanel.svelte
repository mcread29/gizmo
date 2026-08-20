<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import { Button, ConfirmDialog } from '../../components';
	import DomainSettings from '../../domains/DomainSettings.svelte';
	import SettingsPage from '../settings/SettingsPage.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';

	interface Props {
		layout: WorkspaceLayout;
		store: AgentStore;
		workspacePath: string;
		onSelectProfile: () => void;
		onRemoved: () => void;
	}

	let { layout, store, workspacePath, onSelectProfile, onRemoved }: Props =
		$props();

	let project = $derived(
		store.projects.find(({ path }) => path === workspacePath),
	);
	let activeProfile = $derived(
		project?.profiles?.find(({ id }) => id === project?.activeProfileId),
	);
	let removeOpen = $state(false);

	async function removeWorkspace() {
		if (!project) return;
		await store.removeProject(project.path);
		onRemoved();
	}
</script>

<div data-ui="workspace-settings">
	{#if !project}
		<p data-ui="resource-empty">No workspace is selected.</p>
	{:else}
		<SettingsPage title="Profile" scope="Stored in this workspace">
			<div data-ui="settings-card">
				<div data-ui="setting-field">
					<div>
						<strong>{activeProfile?.name ?? 'Default'}</strong>
						<span
							>Extensions, tools, system prompt and skill overrides live in the
							Profile tab.</span
						>
					</div>
					<Button size="sm" onclick={onSelectProfile}>Edit profile</Button>
				</div>
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
