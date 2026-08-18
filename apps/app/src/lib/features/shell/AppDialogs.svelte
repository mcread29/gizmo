<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import ProjectPickerDialog from '../sessions/ProjectPickerDialog.svelte';
	import ThreadDialogs from '../sessions/ThreadDialogs.svelte';
	import type { SessionActions } from '../sessions/session-actions.svelte';

	interface Props {
		store: AgentStore;
		sessions: SessionActions;
	}

	let { store, sessions }: Props = $props();
</script>

<ProjectPickerDialog
	bind:open={sessions.projectPickerOpen}
	{store}
	onSelect={(projectPath) => void sessions.startThread(projectPath)}
/>
<ThreadDialogs {sessions} />
