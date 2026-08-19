<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import ProjectPickerDialog from '../sessions/ProjectPickerDialog.svelte';
	import ThreadDialogs from '../sessions/ThreadDialogs.svelte';
	import type { SessionActions } from '../sessions/session-actions.svelte';
	import type { WorkspaceLayout } from './workspace.svelte';
	import CompileConfirmationDialog from '../unity/CompileConfirmationDialog.svelte';

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
	onSelect={(projectPath) => void sessions.startThread(projectPath)}
/>
<ThreadDialogs {sessions} />
<CompileConfirmationDialog {store} {layout} />
