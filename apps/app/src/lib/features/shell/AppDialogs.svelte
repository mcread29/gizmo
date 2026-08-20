<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import ProjectPickerDialog from '../sessions/ProjectPickerDialog.svelte';
	import ProjectManagerDialog from '../sessions/ProjectManagerDialog.svelte';
	import ThreadDialogs from '../sessions/ThreadDialogs.svelte';
	import type { SessionActions } from '../sessions/session-actions.svelte';
	import type { WorkspaceLayout } from './workspace.svelte';
	import DomainDialogs from '../../domains/DomainDialogs.svelte';

	interface Props {
		store: AgentStore;
		sessions: SessionActions;
		layout: WorkspaceLayout;
	}

	let { store, sessions, layout }: Props = $props();
</script>

<ProjectPickerDialog
	bind:open={sessions.projectPickerOpen}
	{store}
	onSelect={(projectPath, integrations) =>
		void sessions.openWorkspace(projectPath, integrations)}
/>
<ProjectManagerDialog bind:open={sessions.projectManagerOpen} {store} />
<ThreadDialogs {sessions} />
<DomainDialogs {store} {layout} />
