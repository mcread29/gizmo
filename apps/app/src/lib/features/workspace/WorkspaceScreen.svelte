<script lang="ts">
	import { FolderOpen, Plus } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ScrollPanel, Tabs } from '../../components';
	import type { WorkspaceTab } from '../../router.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import WorkspaceHome from './WorkspaceHome.svelte';
	import WorkspaceSettingsPanel from './WorkspaceSettingsPanel.svelte';

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
		{ value: 'settings', label: 'Settings' },
	];

	// Tabs owns its selection, so the route is mirrored in and reported out.
	let active = $state<string>('overview');

	$effect(() => {
		active = tab;
	});

	$effect(() => {
		if (active !== tab) onSelectTab(active as WorkspaceTab);
	});
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
			<span data-ui="eyebrow">Workspace</span>
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
		<p data-ui="resource-empty">This workspace is no longer available.</p>
	{:else}
		<Tabs variant="inspector" items={tabs} bind:value={active}>
			{#snippet children(value)}
				<ScrollPanel name={`workspace-${value}`}>
					<div data-ui="workspace-screen-body">
						{#if value === 'settings'}
							<WorkspaceSettingsPanel
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
							/>
						{/if}
					</div>
				</ScrollPanel>
			{/snippet}
		</Tabs>
	{/if}
</main>
