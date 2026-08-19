<script lang="ts">
	import { FolderOpen, RotateCw } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Dialog } from '../../components';

	interface Props {
		open?: boolean;
		store: AgentStore;
		onSelect: (projectPath: string) => void;
	}

	let { open = $bindable(false), store, onSelect }: Props = $props();
</script>

<Dialog
	bind:open
	title="New thread"
	description="Choose the Unity workspace this thread can inspect and modify"
>
	{#snippet trigger(props)}<button
			{...props}
			data-ui="hidden-trigger"
			hidden
			tabindex="-1">New thread</button
		>{/snippet}
	<div data-ui="project-picker">
		{#if store.projectsLoading}
			{#each { length: 3 } as _, index (index)}
				<div data-ui="skeleton" data-shape="project"></div>
			{/each}
		{:else if store.projects.length === 0}
			<!-- The first screen a new install can land on, so it explains where
			     the list comes from instead of only reporting that it is empty. -->
			<div data-ui="onboarding">
				<strong>No Unity projects yet</strong>
				<p>
					Projects come from the <code>unity</code> command line tool, which
					Gizmo runs as <code>unity projects list</code>. Once that reports your
					projects they appear here.
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
				<button data-ui="project-option" onclick={() => onSelect(project.path)}
					><FolderOpen size={19} /><span
						><strong>{project.title}</strong><small>{project.path}</small></span
					></button
				>
			{/each}
		{/if}
	</div>
</Dialog>
