<script lang="ts">
	import { MessageSquare, Plus, Search } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ScrollPanel } from '../../components';
	import ComponentGallery from '../../components/ComponentGallery.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import ConnectionStatus from './ConnectionStatus.svelte';
	import {
		formatSessionTime,
		groupSessions,
		matchesQuery,
		threadTitle,
	} from './session-groups';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
		focusSearch?: () => void;
		onOpenProjectPicker: () => void;
	}

	let {
		store,
		layout,
		focusSearch = $bindable(),
		onOpenProjectPicker,
	}: Props = $props();

	let query = $state('');
	let searchElement = $state<HTMLInputElement>();

	focusSearch = () => searchElement?.focus();

	let matches = $derived(
		store.sessions.filter((session) =>
			matchesQuery(session, query, workspaceName),
		),
	);
	let groups = $derived(groupSessions(matches));

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
			variant="secondary"
			size="sm"
			disabled={store.connection !== 'connected' ||
				store.projects.length === 0 ||
				store.sessionState === 'streaming'}
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
					<span>Start one against a registered Unity workspace.</span>
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
			{#each groups as group (group.label)}
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
						aria-current={session.id === store.sessionId ? 'page' : undefined}
						onclick={() => store.switchSession(session.id)}
					>
						<MessageSquare size={15} />
						<span>
							<strong>{threadTitle(session.title)}</strong>
							<small title={session.projectPath}
								>{workspaceName(session.projectPath)} · {formatSessionTime(
									session.lastActiveAt,
								)}</small
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
