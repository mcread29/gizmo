<script lang="ts">
	import {
		ChevronRight,
		FolderPlus,
		FolderOpen,
		MessageSquare,
		Plus,
		Search,
		Settings2,
	} from '@lucide/svelte';
	import type { StoredProject } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import {
		Button,
		ScrollPanel,
		Tooltip,
		dropEdge,
		reorderByDrop,
		type DropEdge,
	} from '../../components';
	import ComponentGallery from '../../components/ComponentGallery.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import ConnectionStatus from './ConnectionStatus.svelte';
	import {
		formatSessionTime,
		matchesQuery,
		threadTitle,
	} from './session-groups';

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

	function threadsOf(project: StoredProject) {
		return matches.filter(
			(session) =>
				(session.workspacePath ?? session.projectPath) === project.path,
		);
	}

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
	let draggingPath = $state<string>();
	let drop = $state<{ path: string; edge: DropEdge }>();

	function dragStart(event: DragEvent, project: StoredProject) {
		draggingPath = project.path;
		event.dataTransfer?.setData('text/plain', project.path);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function dragOver(event: DragEvent, project: StoredProject) {
		if (!draggingPath || draggingPath === project.path) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		drop = {
			path: project.path,
			edge: dropEdge(event, event.currentTarget as Element, 'y'),
		};
	}

	function finishDrop(event: DragEvent) {
		event.preventDefault();
		if (draggingPath && drop) {
			const paths = store.projects.map(({ path }) => path);
			const next = reorderByDrop(
				paths,
				paths.indexOf(draggingPath),
				paths.indexOf(drop.path),
				drop.edge,
			);
			if (next.some((path, index) => path !== paths[index])) {
				void store.reorderProjects(next);
			}
		}
		draggingPath = undefined;
		drop = undefined;
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
				{@const threads = threadsOf(project)}
				{@const open = isOpen(project)}
				<div
					data-ui="workspace-row"
					data-active={(workspaceSelected &&
						project.path === openWorkspacePath) ||
						undefined}
					data-dragging={draggingPath === project.path || undefined}
					data-drop={drop?.path === project.path ? drop.edge : undefined}
					draggable="true"
					role="listitem"
					ondragstart={(event) => dragStart(event, project)}
					ondragover={(event) => dragOver(event, project)}
					ondragleave={() => {
						if (drop?.path === project.path) drop = undefined;
					}}
					ondrop={finishDrop}
					ondragend={finishDrop}
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
						onclick={() => onOpenWorkspace(project.path)}
					>
						<FolderOpen size={15} />
						<span>
							<strong>{project.title}</strong>
							<small title={project.path}
								>{`${threads.length} ${threads.length === 1 ? 'thread' : 'threads'}`}</small
							>
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
							<button
								type="button"
								data-ui="session-item"
								data-context-kind="thread"
								data-context-id={session.id}
								data-active={(!workspaceSelected &&
									session.id === store.sessionId) ||
									undefined}
								data-running={store.isSessionStreaming(session.id) || undefined}
								aria-current={!workspaceSelected &&
								session.id === store.sessionId
									? 'page'
									: undefined}
								onclick={() => onOpenThread(session.id)}
							>
								<span data-ui="session-icon"
									><MessageSquare size={15} />
									{#if store.isSessionStreaming(session.id)}<span
											data-ui="session-running"
										></span>
										<span data-ui="sr-only">· agent working</span>{/if}</span
								>
								<span>
									<strong>{threadTitle(session.title)}</strong>
									<small
										>{`${session.messageCount} ${
											session.messageCount === 1 ? 'message' : 'messages'
										} · ${formatSessionTime(session.lastActiveAt)}`}</small
									>
								</span>
							</button>
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
