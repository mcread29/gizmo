<script lang="ts">
	import {
		ArrowRight,
		Boxes,
		GitBranch,
		MessageSquare,
		Plus,
	} from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import { formatSessionTime, threadTitle } from '../sessions/session-groups';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		onOpenThread: (sessionId: string) => void;
		onNewThread: () => void;
		onConfigure: () => void;
	}

	let { store, workspacePath, onOpenThread, onNewThread, onConfigure }: Props =
		$props();
	let project = $derived(
		store.projects.find(({ path }) => path === workspacePath),
	);
	let workspaceSessions = $derived(
		store.sessions.filter(
			(session) =>
				(session.workspacePath ?? session.projectPath) === workspacePath,
		),
	);
	let integrationCount = $derived(project?.integrations.length ?? 0);
	let changedFiles = $derived(store.gitStatus?.files.length ?? 0);
	// Until Git answers there is nothing true to say about the repository.
	let gitPending = $derived(!store.gitStatus && store.gitLoading);

	function name(id: string) {
		return id.charAt(0).toUpperCase() + id.slice(1);
	}
</script>

<div data-ui="workspace-home">
	<!-- A live glance at the workspace, not a set of static tiles. -->
	<div data-ui="workspace-facts">
		<div data-ui="workspace-fact">
			<GitBranch size={15} />
			{#if gitPending}
				<div
					data-ui="skeleton"
					data-shape="line"
					data-width="short"
					aria-label="Loading source control"
				></div>
			{:else}
				<strong>{store.gitStatus?.branch ?? 'No repository'}</strong>
				<span>{changedFiles === 0 ? 'clean' : `${changedFiles} changed`}</span>
			{/if}
		</div>

		<button
			data-ui="workspace-fact"
			data-clickable="true"
			onclick={onConfigure}
		>
			<Boxes size={15} />
			<strong
				>{integrationCount
					? project?.integrations.map(({ id }) => name(id)).join(', ')
					: 'No extensions'}</strong
			>
			<span>{integrationCount ? 'enabled' : 'coding tools only'}</span>
		</button>

		<div data-ui="workspace-fact">
			<MessageSquare size={15} />
			<strong>{workspaceSessions.length}</strong>
			<span>{workspaceSessions.length === 1 ? 'thread' : 'threads'}</span>
		</div>
	</div>

	<section data-ui="workspace-recent">
		<div data-ui="workspace-dashboard-section-heading">
			<h3>Threads</h3>
			<span>Continue previous work</span>
		</div>
		<div data-ui="workspace-recent-list">
			{#if workspaceSessions.length === 0}
				<p data-ui="workspace-dashboard-hint">
					No threads here yet. Start one to begin work in this workspace.
				</p>
			{/if}
			{#each workspaceSessions as session (session.id)}
				<button onclick={() => onOpenThread(session.id)}>
					<MessageSquare size={15} />
					<span>
						<strong>{threadTitle(session.title)}</strong>
						<small
							>{session.messageCount} messages · {formatSessionTime(
								session.lastActiveAt,
							)}</small
						>
					</span>
					<ArrowRight size={15} />
				</button>
			{/each}
		</div>
	</section>

	{#if workspaceSessions.length === 0}
		<div data-ui="workspace-home-actions">
			<Button size="sm" onclick={onNewThread}
				><Plus size={14} /> New thread</Button
			>
		</div>
	{/if}
</div>
