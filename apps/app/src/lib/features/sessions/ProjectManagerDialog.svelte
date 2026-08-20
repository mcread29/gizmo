<script lang="ts">
	import { FolderOpen, Plus, Trash2 } from '@lucide/svelte';
	import type { ProjectDomains, StoredProject } from '@unity-agent/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, ConfirmDialog, Dialog } from '../../components';

	interface Props {
		open?: boolean;
		store: AgentStore;
		onAdd: () => void;
	}

	let { open = $bindable(false), store, onAdd }: Props = $props();
	let domains = $state<Record<string, ProjectDomains['domains']>>({});
	let saving = $state<string>();
	let error = $state<string>();
	let removing = $state<StoredProject>();

	$effect(() => {
		if (!open) return;
		let current = true;
		void Promise.all(
			store.projects.map(
				async (project) =>
					[
						project.path,
						(await store.detectProject(project.path)).domains.filter(
							({ detected }) => detected,
						),
					] as const,
			),
		)
			.then((entries) => {
				if (current) domains = Object.fromEntries(entries);
			})
			.catch((cause) => {
				if (current) error = message(cause);
			});
		return () => (current = false);
	});

	async function changeDomain(project: StoredProject, domainId: string) {
		saving = project.path;
		error = undefined;
		try {
			await store.addProject(project.path, domainId);
		} catch (cause) {
			error = message(cause);
		} finally {
			saving = undefined;
		}
	}

	async function removeProject() {
		if (!removing) return;
		try {
			await store.removeProject(removing.path);
			removing = undefined;
		} catch (cause) {
			error = message(cause);
		}
	}

	function addProject() {
		open = false;
		onAdd();
	}

	function message(value: unknown) {
		return value instanceof Error ? value.message : String(value);
	}
</script>

<Dialog
	bind:open
	title="Projects"
	description="Manage project folders and the domain each one uses"
	size="lg"
>
	<div data-ui="project-manager">
		<div data-ui="project-manager-actions">
			<Button variant="secondary" size="sm" onclick={addProject}
				><Plus size={14} /> Add project</Button
			>
		</div>
		{#if error}<p data-ui="onboarding-error">{error}</p>{/if}
		{#if store.projects.length === 0}
			<div data-ui="onboarding">
				<strong>No projects</strong>
				<span>Add a project folder to start creating threads.</span>
			</div>
		{:else}
			<div data-ui="managed-project-list">
				{#each store.projects as project (project.path)}
					<div data-ui="managed-project">
						<FolderOpen size={18} />
						<span
							><strong>{project.title}</strong><small>{project.path}</small
							></span
						>
						<select
							aria-label={`Domain for ${project.title}`}
							value={project.domainId}
							disabled={saving === project.path || !domains[project.path]}
							onchange={(event) =>
								void changeDomain(project, event.currentTarget.value)}
						>
							{#each domains[project.path] ?? [{ id: project.domainId, name: project.domainId, detected: true }] as domain (domain.id)}
								<option value={domain.id}>{domain.name}</option>
							{/each}
						</select>
						<Button
							variant="ghost"
							size="icon"
							aria-label={`Remove ${project.title}`}
							onclick={() => (removing = project)}><Trash2 size={15} /></Button
						>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Dialog>

<ConfirmDialog
	open={Boolean(removing)}
	title="Remove project?"
	description="This removes the project from Gizmo. Its files and existing threads are not deleted."
	confirmLabel="Remove project"
	onConfirm={removeProject}
	onCancel={() => (removing = undefined)}
/>
