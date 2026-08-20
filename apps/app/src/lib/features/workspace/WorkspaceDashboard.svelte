<script lang="ts">
	import {
		ArrowRight,
		Boxes,
		GitBranch,
		MessageSquare,
		Settings2,
	} from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import { formatSessionTime, threadTitle } from '../sessions/session-groups';

	interface Props {
		store: AgentStore;
		onOpenThread: (sessionId: string) => void;
		onManageWorkspace: () => void;
	}

	let { store, onOpenThread, onManageWorkspace }: Props = $props();
	let project = $derived(
		store.projects.find(({ path }) => path === store.selectedProjectPath),
	);
	let workspaceSessions = $derived(
		store.sessions.filter(
			(session) =>
				(session.workspacePath ?? session.projectPath) ===
				store.selectedProjectPath,
		),
	);
	let recentSessions = $derived(workspaceSessions.slice(0, 5));
	let integrationCount = $derived(project?.integrations.length ?? 0);
	let changedFiles = $derived(store.gitStatus?.files.length ?? 0);

	function name(id: string) {
		return id.charAt(0).toUpperCase() + id.slice(1);
	}
</script>

<div data-ui="workspace-dashboard">
	<header data-ui="workspace-dashboard-heading">
		<div>
			<span data-ui="eyebrow">Workspace overview</span>
			<h2>{project?.title ?? 'Workspace'}</h2>
			{#if project}<p title={project.path}>{project.path}</p>{/if}
		</div>
		<Button variant="secondary" size="sm" onclick={onManageWorkspace}
			><Settings2 size={14} /> Workspace settings</Button
		>
	</header>

	<div data-ui="workspace-summary">
		<section data-ui="workspace-summary-card">
			<GitBranch size={18} />
			<div>
				<span>Source control</span>
				<strong>{store.gitStatus?.branch ?? 'Not available'}</strong>
				<small
					>{store.gitLoading
						? 'Checking repository'
						: changedFiles === 0
							? 'Working tree clean'
							: `${changedFiles} changed ${changedFiles === 1 ? 'file' : 'files'}`}</small
				>
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
			<h3>Recent threads</h3>
			<span>Continue previous work</span>
		</div>
		<div data-ui="workspace-recent-list">
			{#each recentSessions as session (session.id)}
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

	<p data-ui="workspace-dashboard-hint">
		Use the prompt below to start work in this workspace.
	</p>
</div>
