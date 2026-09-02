<script lang="ts">
	import { FolderOpen, Plus } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote, ScrollPanel, Tabs } from '../../components';
	import type { WorkspaceTab } from '../../router.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import WorkspaceConfigurePanel from './WorkspaceConfigurePanel.svelte';
	import WorkspaceHome from './WorkspaceHome.svelte';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
		workspacePath?: string;
		tab: WorkspaceTab;
		onSelectTab: (tab: WorkspaceTab) => void;
		onOpenThread: (sessionId: string) => void;
		onNewThread: (projectPath: string) => void;
		onRemoved: () => void;
	}

	let {
		store,
		layout,
		workspacePath,
		tab,
		onSelectTab,
		onOpenThread,
		onNewThread,
		onRemoved,
	}: Props = $props();

	let project = $derived(
		store.projects.find(({ path }) => path === workspacePath),
	);

	const tabs = [
		{ value: 'overview', label: 'Overview' },
		{ value: 'configure', label: 'Configure' },
	];

	/*
	 * The route is the selection. Tabs is driven from it directly rather than
	 * kept in a second copy: mirroring the prop into local state meant one effect
	 * writing in and another writing out, with an equality check as the only
	 * thing standing between them and a loop.
	 */
	function selectTab(value: string) {
		if (value !== tab) onSelectTab(value as WorkspaceTab);
	}
</script>

<main
	data-ui="workspace-screen"
	data-context-kind="workspace"
	data-context-value={workspacePath}
	aria-label="Workspace"
	tabindex="-1"
>
	<div data-ui="workspace-screen-header">
		<div>
			<h1>{project?.title ?? 'Workspace'}</h1>
			{#if project}
				<p data-ui="workspace-path" title={project.path}>
					<FolderOpen size={13} />{project.path}
				</p>
			{/if}
		</div>
		{#if project}
			<Button
				size="sm"
				disabled={store.connection !== 'connected'}
				onclick={() => onNewThread(project.path)}
				><Plus size={14} /> New thread</Button
			>
		{/if}
	</div>

	{#if !project}
		<ResourceNote>This workspace is no longer available.</ResourceNote>
	{:else}
		<Tabs variant="folder" items={tabs} value={tab} onValueChange={selectTab}>
			{#snippet children(value)}
				<ScrollPanel name={`workspace-${value}`}>
					<div data-ui="workspace-screen-body">
						{#if value === 'configure'}
							<WorkspaceConfigurePanel
								{store}
								{layout}
								workspacePath={project.path}
								{onRemoved}
							/>
						{:else}
							<WorkspaceHome
								{store}
								workspacePath={project.path}
								{onOpenThread}
								onNewThread={() => onNewThread(project.path)}
								onConfigure={() => selectTab('configure')}
							/>
						{/if}
					</div>
				</ScrollPanel>
			{/snippet}
		</Tabs>
	{/if}
</main>
