<script lang="ts">
	import {
		ChevronRight,
		FolderPlus,
		FolderOpen,
		Plus,
		Search,
		Settings2,
	} from '@lucide/svelte';
	import type { StoredProject } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, ScrollPanel, Tooltip } from '../../components';
	import ComponentGallery from '../dev/ComponentGallery.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import ConnectionStatus from './ConnectionStatus.svelte';
	import SessionRow from './SessionRow.svelte';
	import { matchesQuery } from './session-groups';
	import { WorkspaceReorder } from './sidebar-reorder.svelte';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
		/** The workspace whose screen is open, if one is. */
		openWorkspacePath?: string;
		focusSearch?: () => void;
		onOpenWorkspacePicker: () => void;
		onOpenWorkspace: (projectPath: string) => void;
		onOpenWorkspaceSettings: (projectPath: string) => void;
		onNewThread: (projectPath: string) => void;
		onOpenThread: (sessionId: string) => void;
	}

	let {
		store,
		layout,
		openWorkspacePath,
		focusSearch = $bindable(),
		onOpenWorkspacePicker,
		onOpenWorkspace,
		onOpenWorkspaceSettings,
		onNewThread,
		onOpenThread,
	}: Props = $props();

	let query = $state('');
	let searchElement = $state<HTMLInputElement>();
	/** Workspaces the user collapsed. Everything else stays open. */
	let collapsed = $state(new Set<string>());

	focusSearch = () => searchElement?.focus();

	function workspaceName(projectPath: string | undefined) {
		return (
			store.projects.find((project) => project.path === projectPath)?.title ??
			projectPath?.split(/[\\/]/).filter(Boolean).at(-1) ??
			'No workspace'
		);
	}

	let matches = $derived(
		store.sessions.filter((session) =>
			matchesQuery(session, query, workspaceName),
		),
	);

	/*
	 * Bucketed once per change rather than filtered inside the workspace loop:
	 * a filter per project walked every session again, so the sidebar did
	 * projects x sessions work on every keystroke.
	 */
	let threadsByPath = $derived.by(() => {
		const buckets = new Map<string, typeof matches>();
		for (const session of matches) {
			const path = session.workspacePath ?? session.projectPath;
			if (!path) continue;
			const bucket = buckets.get(path);
			if (bucket) bucket.push(session);
			else buckets.set(path, [session]);
		}
		return buckets;
	});

	/**
	 * Exactly one thing is selected: a workspace screen or a thread. Both
	 * highlights derive from that so they can never appear together.
	 */
	let workspaceSelected = $derived(Boolean(openWorkspacePath));

	function isOpen(project: StoredProject) {
		// A search should reveal matches wherever they are.
		return query.trim() !== '' || !collapsed.has(project.path);
	}

	function toggle(project: StoredProject) {
		const next = new Set(collapsed);
		if (!next.delete(project.path)) next.add(project.path);
		collapsed = next;
	}

	// Drag a workspace row to reorder. The order is saved on the agent so
	// every client sees the same sidebar.
	const reorder = new WorkspaceReorder(
		() => store.projects.map(({ path }) => path),
		(next) => void store.reorderProjects(next),
	);

	/** Alt+Arrow is the keyboard equivalent of dragging a workspace row. */
	function reorderKeys(event: KeyboardEvent, project: StoredProject) {
		if (!event.altKey) return;
		const direction =
			event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : undefined;
		if (direction && reorder.move(project.path, direction)) {
			event.preventDefault();
		}
	}
</script>

<aside
	data-ui="sidebar"
	aria-label="Threads"
	inert={!layout.leftVisible || undefined}
>
	<div data-ui="sidebar-header">
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
		<Tooltip text="Open workspace">
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Open workspace"
					disabled={store.connection !== 'connected'}
					onclick={onOpenWorkspacePicker}><FolderPlus size={16} /></Button
				>
			{/snippet}
		</Tooltip>
	</div>

	<ScrollPanel name="threads">
		<nav data-ui="workspace-list" aria-label="Workspaces and threads">
			{#if store.projects.length === 0}
				<div data-ui="sidebar-empty">
					<strong>No workspaces yet</strong>
					<span>Open a folder to start working in it.</span>
					<Button
						variant="secondary"
						size="sm"
						disabled={store.connection !== 'connected'}
						onclick={onOpenWorkspacePicker}
						><FolderOpen size={15} /> Open workspace</Button
					>
				</div>
			{/if}

			{#each store.projects as project (project.path)}
				{@const threads = threadsByPath.get(project.path) ?? []}
				{@const open = isOpen(project)}
				<div
					data-ui="workspace-row"
					data-active={(workspaceSelected &&
						project.path === openWorkspacePath) ||
						undefined}
					data-dragging={reorder.draggingPath === project.path || undefined}
					data-drop={reorder.drop?.path === project.path
						? reorder.drop.edge
						: undefined}
					draggable="true"
					role="group"
					aria-label={project.title}
					ondragstart={(event) => reorder.dragStart(event, project.path)}
					ondragover={(event) => reorder.dragOver(event, project.path)}
					ondragleave={() => reorder.dragLeave(project.path)}
					ondrop={(event) => reorder.finishDrop(event)}
					ondragend={(event) => reorder.finishDrop(event)}
				>
					<button
						data-ui="workspace-disclosure"
						data-open={open || undefined}
						aria-label={`${open ? 'Collapse' : 'Expand'} ${project.title}`}
						aria-expanded={open}
						onclick={() => toggle(project)}
					>
						<ChevronRight size={14} />
					</button>
					<button
						data-ui="workspace-entry"
						data-context-kind="workspace"
						data-context-value={project.path}
						aria-label={`Open ${project.title}`}
						aria-current={project.path === openWorkspacePath
							? 'page'
							: undefined}
						aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
						onclick={() => onOpenWorkspace(project.path)}
						onkeydown={(event) => reorderKeys(event, project)}
					>
						<FolderOpen size={15} />
						<span>
							<strong>{project.title}</strong>
							<!--
								The path, not a thread count: "1 thread" repeated down the rail
								says nothing, while the path is what tells two workspaces of the
								same name apart. The count stays once there is one worth reading.
							-->
							<small title={project.path}>
								{threads.length > 1
									? `${threads.length} threads`
									: project.path}
							</small>
						</span>
					</button>
					<div data-ui="workspace-row-actions">
						<Tooltip text={`New thread in ${project.title}`}>
							{#snippet children(props)}
								<Button
									{...props}
									variant="ghost"
									size="icon"
									aria-label={`New thread in ${project.title}`}
									disabled={store.connection !== 'connected'}
									onclick={() => onNewThread(project.path)}
									><Plus size={15} /></Button
								>
							{/snippet}
						</Tooltip>
						<Tooltip text={`${project.title} settings`}>
							{#snippet children(props)}
								<Button
									{...props}
									variant="ghost"
									size="icon"
									aria-label={`${project.title} settings`}
									onclick={() => onOpenWorkspaceSettings(project.path)}
									><Settings2 size={15} /></Button
								>
							{/snippet}
						</Tooltip>
					</div>
				</div>

				{#if open}
					<div data-ui="workspace-threads">
						{#if threads.length === 0}
							<div data-ui="sidebar-empty" data-scope="workspace">
								<strong
									>{query.trim()
										? 'No matching threads'
										: 'No threads yet'}</strong
								>
								<span
									>{query.trim()
										? 'Try a different search.'
										: 'Start one to begin work here.'}</span
								>
							</div>
						{/if}
						{#each threads as session (session.id)}
							<SessionRow
								{session}
								active={!workspaceSelected && session.id === store.sessionId}
								running={store.isSessionStreaming(session.id)}
								onOpen={() => onOpenThread(session.id)}
							/>
						{/each}
					</div>
				{/if}
			{/each}
		</nav>
	</ScrollPanel>

	<div data-ui="sidebar-footer">
		{#if import.meta.env.DEV}<ComponentGallery />{/if}
		<ConnectionStatus {store} />
	</div>
</aside>
