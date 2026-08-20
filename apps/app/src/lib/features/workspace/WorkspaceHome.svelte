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
	}

	let { store, workspacePath, onOpenThread, onNewThread }: Props = $props();
	let project = $derived(
		store.projects.find(({ path }) => path === workspacePath),
	);
	let workspaceSessions = $derived(
		store.sessions.filter(
			(session) =>
				(session.workspacePath ?? session.projectPath) === workspacePath,
		),
	);
	// The home is where a workspace's threads live, so it lists all of them.
	let integrationCount = $derived(project?.integrations.length ?? 0);
	let changedFiles = $derived(store.gitStatus?.files.length ?? 0);
	// Until Git answers there is nothing true to say about the repository.
	let gitPending = $derived(!store.gitStatus && store.gitLoading);

	function name(id: string) {
		return id.charAt(0).toUpperCase() + id.slice(1);
	}
</script>

<div data-ui="workspace-home">
	<div data-ui="workspace-summary">
		<section data-ui="workspace-summary-card">
			<GitBranch size={18} />
			<div>
				<span>Source control</span>
				{#if gitPending}
					<div
						data-ui="skeleton"
						data-shape="line"
						data-width="short"
						aria-label="Loading source control"
					></div>
					<div data-ui="skeleton" data-shape="line"></div>
				{:else}
					<strong>{store.gitStatus?.branch ?? 'Not available'}</strong>
					<small
						>{changedFiles === 0
							? 'Working tree clean'
							: `${changedFiles} changed ${changedFiles === 1 ? 'file' : 'files'}`}</small
					>
				{/if}
			</div>
		</section>

		<section data-ui="workspace-summary-card">
			<Boxes size={18} />
			<div>
				<span>Integrations</span>
				<strong>{integrationCount || 'None enabled'}</strong>
				<small
					>{project?.integrations.length
						? project.integrations
								.map(({ id, root }) => `${name(id)} at ${root}`)
								.join(', ')
						: 'Standard coding tools only'}</small
				>
			</div>
		</section>

		<section data-ui="workspace-summary-card">
			<MessageSquare size={18} />
			<div>
				<span>Threads</span>
				<strong>{workspaceSessions.length}</strong>
				<small>Saved in this workspace</small>
			</div>
		</section>
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
</div>
