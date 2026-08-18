<script lang="ts">
	import { FolderOpen } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Dialog } from '../../components';

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
			<p data-ui="inspector-message">
				{store.projectError ?? 'No registered Unity projects found.'}
			</p>
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
