<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import ProjectPickerDialog from '../sessions/ProjectPickerDialog.svelte';
	import ThreadDialogs from '../sessions/ThreadDialogs.svelte';
	import type { SessionActions } from '../sessions/session-actions.svelte';
	import SettingsDialog from '../settings/SettingsDialog.svelte';
	import type { WorkspaceLayout } from './workspace.svelte';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
		sessions: SessionActions;
		settingsOpen?: boolean;
	}

	let {
		store,
		layout,
		sessions,
		settingsOpen = $bindable(false),
	}: Props = $props();
</script>

<ProjectPickerDialog
	bind:open={sessions.projectPickerOpen}
	{store}
	onSelect={(projectPath) => void sessions.startThread(projectPath)}
/>
<SettingsDialog bind:open={settingsOpen} {layout} {store} />
<ThreadDialogs {sessions} />
