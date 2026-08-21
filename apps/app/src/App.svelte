<script lang="ts">
	import type { AgentIdentity } from '@unity-agent/protocol';
	import { Tooltip } from 'bits-ui';
	import { onDestroy, onMount, untrack } from 'svelte';
	import {
		AgentStore,
		WebSocketAgentClient,
		type AgentClient,
	} from './lib/agent-client';
	import { saveAppSettings } from './lib/app-settings';
	import { AppRouter, type WorkspaceTab } from './lib/router.svelte';
	import { Toast } from './lib/components';
	import { toasts } from './lib/toasts.svelte';
	import Conversation from './lib/features/conversation/Conversation.svelte';
	import { DraftStore } from './lib/features/conversation/drafts.svelte';
	import { formatToolResult } from './lib/features/conversation/format';
	import SessionSidebar from './lib/features/sessions/SessionSidebar.svelte';
	import { SessionActions } from './lib/features/sessions/session-actions.svelte';
	import AppDialogs from './lib/features/shell/AppDialogs.svelte';
	import AppContextMenu from './lib/features/shell/AppContextMenu.svelte';
	import SettingsScreen from './lib/features/settings/SettingsScreen.svelte';
	import SessionTreeScreen from './lib/features/tree/SessionTreeScreen.svelte';
	import PanelResizeHandle from './lib/features/shell/PanelResizeHandle.svelte';
	import Titlebar from './lib/features/shell/Titlebar.svelte';
	import { handleShortcut } from './lib/features/shell/shortcuts';
	import { WorkspaceLayout } from './lib/features/shell/workspace.svelte';
	import WorkspaceScreen from './lib/features/workspace/WorkspaceScreen.svelte';
	import WorkspaceInspector from './lib/domains/WorkspaceInspector.svelte';
	import { createWorkspaceView } from './lib/domains/workspace-view';

	interface Props {
		client?: AgentClient;
	}

	let { client }: Props = $props();

	const agent: AgentIdentity = {
		name: 'Gizmo',
		version: '0.0.0',
		capabilities: ['editor-status', 'pipeline-commands'],
	};
	const layout = new WorkspaceLayout();
	const store = new AgentStore(
		untrack(
			() =>
				client ??
				new WebSocketAgentClient(
					layout.agentUrl ? { url: layout.agentUrl } : {},
				),
		),
	);
	const sessions = new SessionActions(store, agent.name, toasts);
	const drafts = new DraftStore();

	const router = new AppRouter();
	let focusComposer = $state<() => void>();
	let findInThread = $state<() => void>();
	let focusThreadSearch = $state<() => void>();
	let settingsSaveTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingSettings = layout.settings;

	let currentSession = $derived(
		store.sessions.find((session) => session.id === store.sessionId),
	);
	let workspaceView = $derived(createWorkspaceView(store));
	/** Settings and the tree cover the workspace; the workspace screen is in it. */
	let overlayOpen = $derived(
		router.current === 'settings' || router.current === 'tree',
	);

	// A refresh restores the workspace route from the URL, but the store defaults
	// its selection to the first project. Re-sync so the inspector follows the
	// workspace actually being viewed rather than the default one.
	$effect(() => {
		if (
			router.current === 'workspace' &&
			router.workspacePath &&
			router.workspacePath !== store.selectedProjectPath
		) {
			void sessions.selectWorkspace(router.workspacePath);
		}
	});

	onMount(() => {
		const measure = () => layout.measure();
		measure();
		window.addEventListener('resize', measure);
		const stopRouting = router.start();
		void store.connect();
		return () => {
			window.removeEventListener('resize', measure);
			stopRouting();
			void store.disconnect();
		};
	});

	$effect(() => {
		document.documentElement.dataset.theme = layout.theme;
	});

	$effect(() => {
		store.compactionPolicy = {
			enabled: layout.autoCompact,
			fillPercent: layout.autoCompactFillPercent,
			retainPercent: layout.compactionRetainPercent,
		};
	});

	$effect(() => {
		pendingSettings = layout.settings;
		clearTimeout(settingsSaveTimer);
		settingsSaveTimer = setTimeout(flushSettings, 150);
	});

	function flushSettings() {
		clearTimeout(settingsSaveTimer);
		settingsSaveTimer = undefined;
		saveAppSettings(pendingSettings);
	}

	onDestroy(flushSettings);

	function onKeydown(event: KeyboardEvent) {
		handleShortcut(event, {
			newThread: () => void startThread(),
			openSettings: () => router.go('settings'),
			openTree: () => router.go('tree'),
			focusComposer: () => focusComposer?.(),
			findInThread: () => findInThread?.(),
			searchThreads: () => {
				if (!layout.leftVisible) layout.toggleLeft();
				focusThreadSearch?.();
			},
			toggleLeft: () => layout.toggleLeft(),
			toggleRight: () => layout.toggleRight(),
			dismiss: () => {
				if (router.current === 'workspace') layout.closeDrawers();
				else router.close();
			},
		});
	}

	/**
	 * Opening a workspace shows its screen; it never opens or creates a thread.
	 * The view switches first and the data is fetched behind it, so the whole
	 * shell changes in one frame rather than panel by panel.
	 */
	function showWorkspace(projectPath: string, tab?: WorkspaceTab) {
		router.go('workspace', {
			workspacePath: projectPath,
			...(tab ? { tab } : {}),
		});
		void sessions.selectWorkspace(projectPath);
	}

	/** Opening a thread shows that thread, whatever the centre column was on. */
	async function openThread(sessionId: string) {
		router.go('thread');
		await store.switchSession(sessionId);
	}

	async function startThread(projectPath?: string) {
		router.go('thread');
		if (projectPath) void sessions.selectWorkspace(projectPath);
		await sessions.startThread();
	}

	function contextText(kind: 'message' | 'tool', id: string) {
		for (const message of store.messages) {
			if (kind === 'message' && message.id === id) return message.content;
			if (kind === 'tool') {
				const tool = message.tools.find((candidate) => candidate.id === id);
				if (tool?.result !== undefined) return formatToolResult(tool.result);
			}
		}
	}
</script>

<svelte:head
	><meta
		name="description"
		content="An extensible agent workspace for software projects"
	/></svelte:head
>

<svelte:window onkeydown={onKeydown} />

<Tooltip.Provider delayDuration={350} skipDelayDuration={300}>
	<AppContextMenu
		{layout}
		activeThreadId={store.sessionId}
		canDeleteThread={(sessionId) => !store.isSessionStreaming(sessionId)}
		canOpenEditor={workspaceView.canOpen}
		getContextText={contextText}
		onNewThread={() => void startThread()}
		onOpenThread={(sessionId) => void openThread(sessionId)}
		onRenameThread={(sessionId) => sessions.beginRename(sessionId)}
		onCopyTranscript={(sessionId) => void sessions.copyTranscript(sessionId)}
		onExportTranscript={(sessionId) =>
			void sessions.exportTranscript(sessionId)}
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
				view={workspaceView}
				screenOpen={overlayOpen}
				settingsOpen={router.current === 'settings'}
				onOpenSettings={() => router.go('settings')}
				onCloseSettings={() => router.close()}
			/>

			{#if layout.drawerOpen}<button
					data-ui="drawer-scrim"
					aria-label="Close navigation panels"
					onclick={() => layout.closeDrawers()}
				></button>{/if}

			<SessionSidebar
				{store}
				{layout}
				bind:focusSearch={focusThreadSearch}
				openWorkspacePath={router.current === 'workspace'
					? router.workspacePath
					: undefined}
				onOpenWorkspacePicker={() => (sessions.projectPickerOpen = true)}
				onOpenWorkspace={(projectPath) => showWorkspace(projectPath)}
				onOpenWorkspaceSettings={(projectPath) =>
					showWorkspace(projectPath, 'configure')}
				onNewThread={(projectPath) => void startThread(projectPath)}
				onOpenThread={(sessionId) => void openThread(sessionId)}
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
					onOpenThread={(sessionId) => void openThread(sessionId)}
					onNewThread={(projectPath) => void startThread(projectPath)}
					onRemoved={() => router.close()}
				/>
			{:else}
				<Conversation
					{store}
					{layout}
					{drafts}
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
				onOpenWorkspace={(projectPath) => showWorkspace(projectPath)}
			/>
		</div>
	</AppContextMenu>

	<SettingsScreen
		open={router.current === 'settings'}
		page={router.settingsPage}
		{layout}
		{store}
		version={agent.version}
		onSelectPage={(page) => router.showSettingsPage(page)}
		onOpenWorkspace={() => {
			const path = store.selectedProjectPath;
			if (path) showWorkspace(path, 'configure');
		}}
	/>

	<SessionTreeScreen
		open={router.current === 'tree'}
		{store}
		onClose={() => router.close()}
	/>

	<Toast queue={toasts} />
</Tooltip.Provider>
