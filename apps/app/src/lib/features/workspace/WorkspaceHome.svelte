<script lang="ts">
	import { ArrowRight, MessageSquare, Plus } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import type { WorkspaceTab } from '../../router.svelte';
	import { formatSessionTime, threadTitle } from '../sessions/session-groups';
	import WorkspaceOverridesCard from './overview/WorkspaceOverridesCard.svelte';
	import WorkspaceSummaryCard from './overview/WorkspaceSummaryCard.svelte';
	import type { WorkspaceConfiguration } from './workspace-config.svelte';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		configuration: WorkspaceConfiguration;
		onSelectTab: (tab: WorkspaceTab) => void;
		onOpenThread: (sessionId: string) => void;
		onNewThread: () => void;
	}

	let {
		store,
		workspacePath,
		configuration,
		onSelectTab,
		onOpenThread,
		onNewThread,
	}: Props = $props();
	let workspaceSessions = $derived(
		store.sessions.filter(
			(session) =>
				(session.workspacePath ?? session.projectPath) === workspacePath,
		),
	);
</script>

<div data-ui="workspace-home">
	<!--
		Overview answers the two questions the Configure tabs used to make you
		open them to answer — how is this workspace set up, and what did I change
		here — then gets out of the way of the threads.
	-->
	<WorkspaceSummaryCard {store} {workspacePath} {configuration} {onSelectTab} />
	<WorkspaceOverridesCard
		{store}
		{workspacePath}
		{configuration}
		{onSelectTab}
	/>

	<section data-ui="workspace-recent">
		<div data-ui="workspace-dashboard-section-heading">
			<h3>Threads</h3>
			<span>Continue previous work</span>
		</div>
		{#if workspaceSessions.length === 0}
			<div data-ui="workspace-empty">
				<MessageSquare size={20} />
				<strong>No threads yet</strong>
				<span>Start one to begin work in this workspace.</span>
				<Button size="sm" onclick={onNewThread}>
					<Plus size={14} /> New thread
				</Button>
			</div>
		{:else}
			<div data-ui="workspace-recent-list">
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
		{/if}
	</section>
</div>
