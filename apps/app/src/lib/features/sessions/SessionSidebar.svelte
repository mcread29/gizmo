<script lang="ts">
	import {
		Check,
		ChevronsUpDown,
		FolderPlus,
		FolderOpen,
		MessageSquare,
		Plus,
		Search,
		Settings2,
	} from '@lucide/svelte';
	import type { WorkspaceIntegration } from '@unity-agent/protocol';
	import { DropdownMenu } from 'bits-ui';
	import type { AgentStore } from '../../agent-client';
	import { Button, ScrollPanel } from '../../components';
	import ComponentGallery from '../../components/ComponentGallery.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import ConnectionStatus from './ConnectionStatus.svelte';
	import {
		formatSessionTime,
		groupSessionsByProject,
		matchesQuery,
		threadTitle,
	} from './session-groups';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
		focusSearch?: () => void;
		onOpenWorkspacePicker: () => void;
		onOpenWorkspace: (
			projectPath: string,
			integrations: WorkspaceIntegration[],
		) => void;
		onNewThread: () => void;
		onManageProjects: () => void;
	}

	let {
		store,
		layout,
		focusSearch = $bindable(),
		onOpenWorkspacePicker,
		onOpenWorkspace,
		onNewThread,
		onManageProjects,
	}: Props = $props();

	let query = $state('');
	let searchElement = $state<HTMLInputElement>();

	focusSearch = () => searchElement?.focus();

	let matches = $derived(
		store.sessions.filter(
			(session) =>
				(session.workspacePath ?? session.projectPath) ===
					store.selectedProjectPath &&
				matchesQuery(session, query, workspaceName),
		),
	);
	let groups = $derived(groupSessionsByProject(matches, workspaceName));

	function workspaceName(projectPath: string | undefined) {
		return (
			store.projects.find((project) => project.path === projectPath)?.title ??
			projectPath?.split(/[\\/]/).filter(Boolean).at(-1) ??
			'No workspace'
		);
	}

	let currentWorkspace = $derived(workspaceName(store.selectedProjectPath));
</script>

<aside
	data-ui="sidebar"
	aria-label="Threads"
	inert={!layout.leftVisible || undefined}
>
	{#if !store.selectedProjectPath}
		<div data-ui="sidebar-open-workspace">
			<Button
				disabled={store.connection !== 'connected'}
				onclick={onOpenWorkspacePicker}
				><FolderOpen size={15} /> Open workspace</Button
			>
		</div>
	{:else}
		<div data-ui="sidebar-header">
			<span data-ui="eyebrow">Threads</span>
			<Button
				variant="secondary"
				size="sm"
				disabled={store.connection !== 'connected' ||
					!store.selectedProjectPath}
				onclick={onNewThread}><Plus size={14} /> New thread</Button
			>
		</div>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						data-ui="workspace-switcher"
						aria-label={`Workspace menu, ${currentWorkspace}`}
					>
						<span data-ui="workspace-switcher-icon"
							><FolderOpen size={16} /></span
						>
						<span><small>Workspace</small><strong>{currentWorkspace}</strong></span>
						<ChevronsUpDown size={14} />
					</button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					data-ui="workspace-menu"
					sideOffset={6}
					align="start"
				>
					<div data-ui="workspace-menu-label">Workspaces</div>
					{#each store.projects as project (project.path)}
						<DropdownMenu.Item
							data-ui="workspace-menu-item"
							onSelect={() =>
								onOpenWorkspace(project.path, project.integrations)}
						>
							<FolderOpen size={15} />
							<span>
								<strong>{project.title}</strong>
								<small>{project.path}</small>
							</span>
							{#if project.path === store.selectedProjectPath}<Check
									size={15}
									aria-label="Current workspace"
								/>{/if}
						</DropdownMenu.Item>
					{/each}
					<DropdownMenu.Separator data-ui="workspace-menu-separator" />
					<DropdownMenu.Item
						data-ui="workspace-menu-action"
						onSelect={onOpenWorkspacePicker}
					>
						<FolderPlus size={15} /> Open workspace…
					</DropdownMenu.Item>
					<DropdownMenu.Item
						data-ui="workspace-menu-action"
						onSelect={onManageProjects}
					>
						<Settings2 size={15} /> Workspace settings…
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>

		<div data-ui="sidebar-search">
			<Search size={14} />
			<label for="thread-search" data-ui="sr-only">Search threads</label>
			<input
				id="thread-search"
				bind:this={searchElement}
				bind:value={query}
				type="search"
				placeholder="Search threads"
				autocomplete="off"
			/>
		</div>

		<ScrollPanel name="threads">
			<nav data-ui="session-list" aria-label="Recent threads">
				{#if matches.length === 0 && !query}
					<div data-ui="sidebar-empty">
						<strong>No threads yet</strong>
						<span>Start one in a workspace.</span>
						<Button
							variant="secondary"
							size="sm"
							disabled={store.connection !== 'connected' ||
								!store.selectedProjectPath}
							onclick={onNewThread}><Plus size={14} /> New thread</Button
						>
					</div>
				{:else if matches.length === 0}
					<p data-ui="sidebar-empty">
						<span>No threads match “{query}”.</span>
					</p>
				{/if}
				{#each groups as group (group.sessions[0]?.workspacePath ?? group.sessions[0]?.projectPath ?? group.label)}
					<div data-ui="section-label">
						<span>{group.label}</span><span>{group.sessions.length}</span>
					</div>
					{#each group.sessions as session (session.id)}
						<button
							type="button"
							data-ui="session-item"
							data-context-kind="thread"
							data-context-id={session.id}
							data-active={session.id === store.sessionId || undefined}
							data-running={store.isSessionStreaming(session.id) || undefined}
							aria-current={session.id === store.sessionId ? 'page' : undefined}
							onclick={() => store.switchSession(session.id)}
						>
							<span data-ui="session-icon"
								><MessageSquare size={15} />
								{#if store.isSessionStreaming(session.id)}<span
										data-ui="session-running"
										aria-label="Agent working"
									></span>{/if}</span
							>
							<span>
								<strong>{threadTitle(session.title)}</strong>
								<small title={session.workspacePath ?? session.projectPath}
									>{formatSessionTime(session.lastActiveAt)}</small
								>
							</span>
						</button>
					{/each}
				{/each}
			</nav>
		</ScrollPanel>
	{/if}

	<div data-ui="sidebar-footer">
		{#if import.meta.env.DEV}<ComponentGallery />{/if}
		<ConnectionStatus {store} />
	</div>
</aside>
