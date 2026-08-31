<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import type { AppRouter } from '../../router.svelte';
	import SettingsScreen from '../settings/SettingsScreen.svelte';
	import SessionTreeScreen from '../tree/SessionTreeScreen.svelte';
	import type { WorkspaceLayout } from './workspace.svelte';

	interface Props {
		router: AppRouter;
		layout: WorkspaceLayout;
		store: AgentStore;
		version: string;
		settingsDirty?: boolean;
		onShowWorkspaceSettings: (projectPath: string) => void;
	}

	let {
		router,
		layout,
		store,
		version,
		settingsDirty = $bindable(false),
		onShowWorkspaceSettings,
	}: Props = $props();
</script>

<SettingsScreen
	open={router.current === 'settings'}
	bind:dirty={settingsDirty}
	page={router.settingsPage}
	{layout}
	{store}
	{version}
	onSelectPage={(page) => router.showSettingsPage(page)}
	onOpenWorkspace={() => {
		const path = store.selectedProjectPath;
		if (path) onShowWorkspaceSettings(path);
	}}
/>

<SessionTreeScreen
	open={router.current === 'tree'}
	{store}
	onClose={() => router.close()}
/>
