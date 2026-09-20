<script lang="ts">
	import { FolderOpen, Plus } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote, ScrollPanel, Tabs } from '../../components';
	import type { WorkspaceTab } from '../../router.svelte';
	import DiscardChangesDialog from '../settings/DiscardChangesDialog.svelte';
	import { UnsavedChangesGuard } from '../settings/unsaved-changes.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import WorkspaceActionsMenu from './WorkspaceActionsMenu.svelte';
	import WorkspaceExtensionsPanel from './WorkspaceExtensionsPanel.svelte';
	import WorkspaceHome from './WorkspaceHome.svelte';
	import WorkspaceMemoryPanel from './WorkspaceMemoryPanel.svelte';
	import WorkspaceSkillsPanel from './WorkspaceSkillsPanel.svelte';
	import { WorkspaceConfiguration } from './workspace-config.svelte';

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
		{ value: 'memory', label: 'Memory' },
		{ value: 'skills', label: 'Skills' },
		{ value: 'extensions', label: 'Extensions' },
	];

	const configuration = new WorkspaceConfiguration();
	const guard = new UnsavedChangesGuard();

	/*
	 * The lookup must stay tracked: an untracked read with an early return left
	 * the screen permanently blank whenever the effect ran before the catalog
	 * loaded, because it never re-fired. Reading it through a derived boolean
	 * keeps that while stopping every unrelated catalog update from reloading
	 * the configuration — which would now also tear down an AGENTS.md draft.
	 */
	let registered = $derived(
		store.projects.some(({ path }) => path === workspacePath),
	);

	$effect(() => {
		// A draft belongs to the workspace it was typed in.
		guard.dirty = false;
		guard.cancel();
		return configuration.load(store, registered ? workspacePath : undefined);
	});

	/*
	 * The route is the selection. Tabs is driven from it directly rather than
	 * kept in a second copy: mirroring the prop into local state meant one effect
	 * writing in and another writing out, with an equality check as the only
	 * thing standing between them and a loop.
	 */
	function selectTab(value: string) {
		if (value === tab) return;
		// AGENTS.md is the one editor here with a Save step, and it lives on
		// Overview, so leaving a tab is the only navigation that can drop work.
		guard.guard('Discard the unsaved changes to AGENTS.md?', () =>
			onSelectTab(value as WorkspaceTab),
		);
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
					<FolderOpen size={13} />
					<span>{project.path}</span>
				</p>
			{/if}
		</div>
		{#if project}
			<div data-ui="workspace-screen-actions">
				<Button
					size="sm"
					disabled={store.connection !== 'connected'}
					onclick={() => onNewThread(project.path)}
					><Plus size={14} /> New thread</Button
				>
				<WorkspaceActionsMenu
					{store}
					workspacePath={project.path}
					{onRemoved}
				/>
			</div>
		{/if}
	</div>

	{#if !project}
		<ResourceNote>This workspace is no longer available.</ResourceNote>
	{:else}
		<!-- lazy: the skills library is a hundred rows, and most visits here
			never open it. -->
		<Tabs
			variant="folder"
			lazy
			items={tabs}
			value={tab}
			onValueChange={selectTab}
		>
			{#snippet children(value)}
				<ScrollPanel name={`workspace-${value}`}>
					<div data-ui="workspace-screen-body">
						{#if value === 'overview'}
							<WorkspaceHome
								{store}
								workspacePath={project.path}
								{configuration}
								{guard}
								{onSelectTab}
								{onOpenThread}
								onNewThread={() => onNewThread(project.path)}
							/>
						{:else if value === 'memory'}
							<!-- Memory reads the journal, not the project config, so it
								does not wait on the configuration the other tabs edit. -->
							<div data-ui="workspace-configure">
								<WorkspaceMemoryPanel
									{store}
									workspacePath={project.path}
									onOverrideChange={() =>
										configuration.refreshMemory(store, project.path)}
								/>
							</div>
						{:else if configuration.config}
							<div data-ui="workspace-configure">
								{#if value === 'skills'}
									<WorkspaceSkillsPanel
										{store}
										workspacePath={project.path}
										{configuration}
									/>
								{:else}
									<WorkspaceExtensionsPanel
										{store}
										{layout}
										workspacePath={project.path}
										{configuration}
									/>
								{/if}
								{#if configuration.error}
									<ResourceNote tone="error">{configuration.error}</ResourceNote
									>
								{/if}
							</div>
						{:else}
							{#if configuration.error}
								<ResourceNote tone="error">{configuration.error}</ResourceNote>
							{/if}
							<div data-ui="skeleton" data-shape="workspace-card"></div>
						{/if}
					</div>
				</ScrollPanel>
			{/snippet}
		</Tabs>
	{/if}
</main>

<DiscardChangesDialog {guard} />
