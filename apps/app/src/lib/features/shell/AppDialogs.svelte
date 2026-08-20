<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import ProjectPickerDialog from '../sessions/ProjectPickerDialog.svelte';
	import ThreadDialogs from '../sessions/ThreadDialogs.svelte';
	import type { SessionActions } from '../sessions/session-actions.svelte';
	import type { WorkspaceLayout } from './workspace.svelte';
	import DomainDialogs from '../../domains/DomainDialogs.svelte';

	interface Props {
		store: AgentStore;
		sessions: SessionActions;
		layout: WorkspaceLayout;
		/** A workspace added from the picker is shown, not opened in a thread. */
		onOpenWorkspace: (projectPath: string) => void;
	}

	let { store, sessions, layout, onOpenWorkspace }: Props = $props();
</script>

<ProjectPickerDialog
	bind:open={sessions.projectPickerOpen}
	{store}
	onSelect={(projectPath) => {
		sessions.projectPickerOpen = false;
		onOpenWorkspace(projectPath);
	}}
/>
<ThreadDialogs {sessions} />
<DomainDialogs {store} {layout} />
