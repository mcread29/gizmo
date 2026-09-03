<script lang="ts">
	import type { CommandContribution } from '../../../extensions/types';
	import RootCommandList from './RootCommandList.svelte';
	import type { CommandPaletteMode, WorkspacePaletteStore } from './types';
	import WorkspaceBrowser from './WorkspaceBrowser.svelte';

	interface Props {
		initialMode: CommandPaletteMode;
		store: WorkspacePaletteStore;
		extensionCommands: CommandContribution[];
		onSelectWorkspace: (projectPath: string) => void;
		onNewThread: () => void;
		onOpenSettings: () => void;
		onReloadExtensions: () => void;
		onSearchThreads: () => void;
		onClose: () => void;
	}

	let {
		initialMode,
		store,
		extensionCommands,
		onSelectWorkspace,
		onNewThread,
		onOpenSettings,
		onReloadExtensions,
		onSearchThreads,
		onClose,
	}: Props = $props();

	let mode = $derived(initialMode);

	function selectWorkspace(projectPath: string) {
		onSelectWorkspace(projectPath);
		onClose();
	}
</script>

{#if mode === 'root'}
	<RootCommandList
		{extensionCommands}
		onOpenWorkspace={() => (mode = 'workspace')}
		{onNewThread}
		{onOpenSettings}
		{onReloadExtensions}
		{onSearchThreads}
		{onClose}
	/>
{:else}
	<WorkspaceBrowser
		{store}
		onBack={() => (mode = 'root')}
		onWorkspaceAdded={selectWorkspace}
	/>
{/if}
