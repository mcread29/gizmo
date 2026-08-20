<script lang="ts">
	import { FolderOpen, RotateCw } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import type { ProjectDomains } from '@unity-agent/protocol';
	import { Button, Dialog } from '../../components';
	import { isDesktop, pickWorkspaceDirectory } from '../../desktop';

	interface Props {
		open?: boolean;
		store: AgentStore;
		onSelect: (projectPath: string, domainId: string) => void;
	}

	let { open = $bindable(false), store, onSelect }: Props = $props();
	let path = $state('');
	let domains = $state<ProjectDomains['domains']>([]);
	let domainId = $state('generic');
	let detecting = $state(false);
	let addError = $state<string>();

	async function browse() {
		const selected = await pickWorkspaceDirectory();
		if (selected) await inspect(selected);
	}

	async function inspect(selected = path.trim()) {
		if (!selected) return;
		path = selected;
		detecting = true;
		addError = undefined;
		try {
			domains = (await store.detectProject(selected)).domains.filter(
				({ detected }) => detected,
			);
			domainId = domains.find(({ id }) => id !== 'generic')?.id ?? 'generic';
		} catch (error) {
			addError = error instanceof Error ? error.message : String(error);
		} finally {
			detecting = false;
		}
	}

	async function submit() {
		const selected = path.trim();
		if (!selected) return;
		if (!domains.length) {
			await inspect(selected);
			return;
		}
		try {
			const project = await store.addProject(selected, domainId);
			onSelect(project.path, project.domainId);
		} catch (error) {
			addError = error instanceof Error ? error.message : String(error);
		}
	}
</script>

<Dialog
	bind:open
	title="New thread"
	description="Choose the workspace this thread can inspect and modify"
>
	{#snippet trigger(props)}<button
			{...props}
			data-ui="hidden-trigger"
			hidden
			tabindex="-1">New thread</button
		>{/snippet}
	<div data-ui="project-picker">
		<form
			data-ui="workspace-path"
			onsubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			<input
				bind:value={path}
				oninput={() => (domains = [])}
				placeholder="/path/to/workspace"
				aria-label="Workspace path"
			/>
			{#if isDesktop()}
				<Button
					type="button"
					variant="secondary"
					size="sm"
					onclick={() => void browse()}><FolderOpen size={14} /> Browse</Button
				>
			{/if}
			{#if domains.length}
				<select bind:value={domainId} aria-label="Project domain">
					{#each domains as domain (domain.id)}<option value={domain.id}
							>{domain.name}</option
						>{/each}
				</select>
			{/if}
			<Button type="submit" size="sm" disabled={!path.trim() || detecting}
				>{detecting
					? 'Detecting…'
					: domains.length
						? 'Add'
						: 'Continue'}</Button
			>
		</form>
		{#if addError}<p data-ui="onboarding-error">{addError}</p>{/if}
		{#if store.projectsLoading}
			{#each { length: 3 } as _, index (index)}
				<div data-ui="skeleton" data-shape="project"></div>
			{/each}
		{:else if store.projects.length === 0}
			<!-- The first screen a new install can land on, so it explains where
			     the list comes from instead of only reporting that it is empty. -->
			<div data-ui="onboarding">
				<strong>No projects yet</strong>
				<p>
					Choose any project folder above. Installed domain extensions are
					detected when the thread starts.
				</p>
				{#if store.projectError}
					<p data-ui="onboarding-error">{store.projectError}</p>
				{/if}
				<Button
					variant="secondary"
					size="sm"
					disabled={store.connection !== 'connected'}
					onclick={() => void store.refreshProjects()}
					><RotateCw size={13} /> Reload projects</Button
				>
			</div>
		{:else}
			{#each store.projects as project (project.path)}
				<button
					data-ui="project-option"
					onclick={() => onSelect(project.path, project.domainId)}
					><FolderOpen size={19} /><span
						><strong>{project.title}</strong><small
							>{project.domainId} · {project.path}</small
						></span
					></button
				>
			{/each}
		{/if}
	</div>
</Dialog>
