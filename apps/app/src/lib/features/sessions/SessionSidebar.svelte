<script lang="ts">
	import { FolderCog, MessageSquare, Plus, Search } from '@lucide/svelte';
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
		onOpenProjectPicker: () => void;
		onManageProjects: () => void;
	}

	let {
		store,
		layout,
		focusSearch = $bindable(),
		onOpenProjectPicker,
		onManageProjects,
	}: Props = $props();

	let query = $state('');
	let searchElement = $state<HTMLInputElement>();

	focusSearch = () => searchElement?.focus();

	let matches = $derived(
		store.sessions.filter((session) =>
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
</script>

<aside
	data-ui="sidebar"
	aria-label="Threads"
	inert={!layout.leftVisible || undefined}
>
	<div data-ui="sidebar-header">
		<span data-ui="eyebrow">Threads</span>
		<Button
			variant="ghost"
			size="icon"
			aria-label="Manage projects"
			disabled={store.connection !== 'connected'}
			onclick={onManageProjects}><FolderCog size={15} /></Button
		>
		<Button
			variant="secondary"
			size="sm"
			disabled={store.connection !== 'connected' || store.projects.length === 0}
			onclick={onOpenProjectPicker}><Plus size={14} /> New thread</Button
		>
	</div>

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
			{#if store.sessions.length === 0}
				<div data-ui="sidebar-empty">
					<strong>No threads yet</strong>
					<span>Start one in a workspace.</span>
					<Button
						variant="secondary"
						size="sm"
						disabled={store.connection !== 'connected' ||
							store.projects.length === 0}
						onclick={onOpenProjectPicker}><Plus size={14} /> New thread</Button
					>
				</div>
			{:else if matches.length === 0}
				<p data-ui="sidebar-empty"><span>No threads match “{query}”.</span></p>
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

	<div data-ui="sidebar-footer">
		{#if import.meta.env.DEV}<ComponentGallery />{/if}
		<ConnectionStatus {store} />
	</div>
</aside>
