<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import CommandPalette from '../sessions/CommandPalette.svelte';
	import ThreadDialogs from '../sessions/ThreadDialogs.svelte';
	import type { SessionActions } from '../sessions/session-actions.svelte';
	import type { WorkspaceLayout } from './workspace.svelte';
	import ExtensionDialogs from '../../extensions/ExtensionDialogs.svelte';

	interface Props {
		store: AgentStore;
		sessions: SessionActions;
		layout: WorkspaceLayout;
		/** A workspace added from the picker is shown, not opened in a thread. */
		onOpenWorkspace: (projectPath: string) => void;
		onNewThread: () => void;
		onOpenSettings: () => void;
		onSearchThreads: () => void;
	}

	let {
		store,
		sessions,
		layout,
		onOpenWorkspace,
		onNewThread,
		onOpenSettings,
		onSearchThreads,
	}: Props = $props();
</script>

<CommandPalette
	bind:open={sessions.commandPaletteOpen}
	initialMode={sessions.commandPaletteMode}
	{store}
	onSelectWorkspace={(projectPath) => {
		sessions.commandPaletteOpen = false;
		onOpenWorkspace(projectPath);
	}}
	{onNewThread}
	{onOpenSettings}
	{onSearchThreads}
/>
<ThreadDialogs {sessions} />
<ExtensionDialogs {store} {layout} />
