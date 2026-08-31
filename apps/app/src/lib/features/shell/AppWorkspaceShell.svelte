<script lang="ts">
	import type { AgentIdentity } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import type { AppRouter, WorkspaceTab } from '../../router.svelte';
	import WorkspaceInspector from '../../extensions/WorkspaceInspector.svelte';
	import { createWorkspaceView } from '../../extensions/workspace-view';
	import Conversation from '../conversation/Conversation.svelte';
	import type { DraftStore } from '../conversation/drafts.svelte';
	import type { PiExtensionUiStore } from '../extension-ui/PiExtensionUiStore.svelte';
	import SessionSidebar from '../sessions/SessionSidebar.svelte';
	import type { SessionActions } from '../sessions/session-actions.svelte';
	import WorkspaceScreen from '../workspace/WorkspaceScreen.svelte';
	import AppContextMenu from './AppContextMenu.svelte';
	import AppDialogs from './AppDialogs.svelte';
	import PanelResizeHandle from './PanelResizeHandle.svelte';
	import Titlebar from './Titlebar.svelte';
	import type { WorkspaceLayout } from './workspace.svelte';

	interface Props {
		agent: AgentIdentity;
		store: AgentStore;
		sessions: SessionActions;
		layout: WorkspaceLayout;
		drafts: DraftStore;
		extensionUi: PiExtensionUiStore;
		router: AppRouter;
		focusComposer?: () => void;
		findInThread?: () => void;
		focusThreadSearch?: () => void;
		onCloseSettings: () => void;
		onShowWorkspace: (projectPath: string, tab?: WorkspaceTab) => void;
		onOpenThread: (sessionId: string) => Promise<void>;
		onStartThread: (projectPath?: string) => Promise<void>;
		getContextText: (
			kind: 'message' | 'tool',
			id: string,
		) => string | undefined;
	}

	let {
		agent,
		store,
		sessions,
		layout,
		drafts,
		extensionUi,
		router,
		focusComposer = $bindable(),
		findInThread = $bindable(),
		focusThreadSearch = $bindable(),
		onCloseSettings,
		onShowWorkspace,
		onOpenThread,
		onStartThread,
		getContextText,
	}: Props = $props();

	let currentSession = $derived(
		store.sessions.find((session) => session.id === store.sessionId),
	);
	let workspaceView = $derived(createWorkspaceView(store));
	let overlayOpen = $derived(
		router.current === 'settings' || router.current === 'tree',
	);

	function searchThreads() {
		if (!layout.leftVisible) layout.toggleLeft();
		focusThreadSearch?.();
	}
</script>

<AppContextMenu
	{layout}
	activeThreadId={store.sessionId}
	canDeleteThread={(sessionId) => !store.isSessionStreaming(sessionId)}
	canOpenEditor={workspaceView.canOpen}
	{getContextText}
	onNewThread={() => void onStartThread()}
	onOpenThread={(sessionId) => void onOpenThread(sessionId)}
	onRenameThread={(sessionId) => sessions.beginRename(sessionId)}
	onCopyTranscript={(sessionId) => void sessions.copyTranscript(sessionId)}
	onExportTranscript={(sessionId) => void sessions.exportTranscript(sessionId)}
	onDeleteThread={(sessionId) => sessions.beginDelete(sessionId)}
	onOpenEditor={workspaceView.open}
	onRefreshEditor={workspaceView.refresh}
	onOpenSettings={() => router.go('settings')}
>
	<div
		data-ui="app-shell"
		data-left-mode={layout.leftMode}
		data-right-mode={layout.rightMode}
		data-left-visible={layout.leftVisible}
		data-right-visible={layout.rightVisible}
		data-screen-open={overlayOpen || undefined}
		style={`--sidebar-width:${layout.sidebarWidth}px;--inspector-width:${layout.inspectorWidth}px`}
	>
		<Titlebar
			{agent}
			{layout}
			{store}
			{extensionUi}
			view={workspaceView}
			screenOpen={overlayOpen}
			settingsOpen={router.current === 'settings'}
			onOpenSettings={() => router.go('settings')}
			{onCloseSettings}
		/>

		{#if layout.drawerOpen}
			<button
				data-ui="drawer-scrim"
				aria-label="Close navigation panels"
				onclick={() => layout.closeDrawers()}
			></button>
		{/if}

		<SessionSidebar
			{store}
			{layout}
			bind:focusSearch={focusThreadSearch}
			openWorkspacePath={router.current === 'workspace'
				? router.workspacePath
				: undefined}
			onOpenWorkspacePicker={() => sessions.openCommandPalette('workspace')}
			onOpenWorkspace={(projectPath) => onShowWorkspace(projectPath)}
			onOpenWorkspaceSettings={(projectPath) =>
				onShowWorkspace(projectPath, 'configure')}
			onNewThread={(projectPath) => void onStartThread(projectPath)}
			onOpenThread={(sessionId) => void onOpenThread(sessionId)}
		/>
		{#if layout.leftVisible && layout.leftMode === 'docked'}
			<PanelResizeHandle
				side="left"
				size={layout.sidebarWidth}
				max={layout.sidebarMax}
				onResize={(size) => layout.resize('sidebar', size)}
				onReset={() => layout.reset('sidebar')}
			/>
		{/if}

		{#if router.current === 'workspace'}
			<WorkspaceScreen
				{store}
				{layout}
				workspacePath={router.workspacePath}
				tab={router.workspaceTab}
				onSelectTab={(tab) => router.showWorkspaceTab(tab)}
				onOpenThread={(sessionId) => void onOpenThread(sessionId)}
				onNewThread={(projectPath) => void onStartThread(projectPath)}
				onRemoved={() => router.close()}
			/>
		{:else}
			<Conversation
				{store}
				{layout}
				{drafts}
				{extensionUi}
				agentName={agent.name}
				{currentSession}
				bind:focusComposer
				bind:findInThread
				onRename={() => sessions.beginRename()}
				onCopy={() => void sessions.copyTranscript()}
				onExport={() => void sessions.exportTranscript()}
				onDelete={() => sessions.beginDelete()}
				onOpenTree={() => router.go('tree')}
			/>
		{/if}

		<WorkspaceInspector
			{store}
			view={workspaceView}
			hidden={!layout.rightVisible}
		/>
		{#if layout.rightVisible && layout.rightMode === 'docked'}
			<PanelResizeHandle
				side="right"
				size={layout.inspectorWidth}
				max={layout.inspectorMax}
				onResize={(size) => layout.resize('inspector', size)}
				onReset={() => layout.reset('inspector')}
			/>
		{/if}

		<AppDialogs
			{store}
			{sessions}
			{layout}
			{extensionUi}
			onOpenWorkspace={(projectPath) => onShowWorkspace(projectPath)}
			onNewThread={() => void onStartThread()}
			onOpenSettings={() => router.go('settings')}
			onSearchThreads={searchThreads}
		/>
	</div>
</AppContextMenu>
