<script lang="ts">
	import type { AgentIdentity } from '@unity-agent/protocol';
	import { Tooltip } from 'bits-ui';
	import { onMount, untrack } from 'svelte';
	import {
		AgentStore,
		WebSocketAgentClient,
		type AgentClient,
	} from './lib/agent-client';
	import { saveAppSettings } from './lib/app-settings';
	import { Toast } from './lib/components';
	import { toasts } from './lib/toasts.svelte';
	import Conversation from './lib/features/conversation/Conversation.svelte';
	import { DraftStore } from './lib/features/conversation/drafts.svelte';
	import { formatToolResult } from './lib/features/conversation/format';
	import SessionSidebar from './lib/features/sessions/SessionSidebar.svelte';
	import { SessionActions } from './lib/features/sessions/session-actions.svelte';
	import AppDialogs from './lib/features/shell/AppDialogs.svelte';
	import AppContextMenu from './lib/features/shell/AppContextMenu.svelte';
	import PanelResizeHandle from './lib/features/shell/PanelResizeHandle.svelte';
	import Titlebar from './lib/features/shell/Titlebar.svelte';
	import { handleShortcut } from './lib/features/shell/shortcuts';
	import { WorkspaceLayout } from './lib/features/shell/workspace.svelte';
	import UnityInspector from './lib/features/unity/UnityInspector.svelte';
	import { createUnityView } from './lib/features/unity/unity-view';

	interface Props {
		client?: AgentClient;
	}

	let { client }: Props = $props();

	const agent: AgentIdentity = {
		name: 'Unity Agent',
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

	let settingsOpen = $state(false);
	let focusComposer = $state<() => void>();
	let focusThreadSearch = $state<() => void>();

	let currentSession = $derived(
		store.sessions.find((session) => session.id === store.sessionId),
	);
	let unityView = $derived(
		createUnityView({
			messages: store.messages,
			projects: store.projects,
			selectedProjectPath: store.selectedProjectPath,
			projectStatus: store.projectStatus,
			projectsLoading: store.projectsLoading,
		}),
	);

	onMount(() => {
		const measure = () => layout.measure();
		measure();
		window.addEventListener('resize', measure);
		void store.connect();
		return () => {
			window.removeEventListener('resize', measure);
			void store.disconnect();
		};
	});

	$effect(() => {
		document.documentElement.dataset.theme = layout.theme;
		saveAppSettings(layout.settings);
	});

	function onKeydown(event: KeyboardEvent) {
		handleShortcut(event, {
			newThread: () => (sessions.projectPickerOpen = true),
			openSettings: () => (settingsOpen = true),
			focusComposer: () => focusComposer?.(),
			searchThreads: () => {
				if (!layout.leftVisible) layout.toggleLeft();
				focusThreadSearch?.();
			},
			toggleLeft: () => layout.toggleLeft(),
			toggleRight: () => layout.toggleRight(),
			dismiss: () => layout.closeDrawers(),
		});
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
		content="An agent workspace for the Unity Editor"
	/></svelte:head
>

<svelte:window onkeydown={onKeydown} />

<Tooltip.Provider delayDuration={350} skipDelayDuration={300}>
	<AppContextMenu
		{layout}
		activeThreadId={store.sessionId}
		canDeleteThread={store.sessionState !== 'streaming'}
		canOpenEditor={Boolean(unityView.selectedProject && !unityView.editor)}
		getContextText={contextText}
		onNewThread={() => (sessions.projectPickerOpen = true)}
		onOpenThread={(sessionId) => void store.switchSession(sessionId)}
		onRenameThread={(sessionId) => sessions.beginRename(sessionId)}
		onCopyTranscript={(sessionId) => void sessions.copyTranscript(sessionId)}
		onExportTranscript={(sessionId) =>
			void sessions.exportTranscript(sessionId)}
		onDeleteThread={(sessionId) => sessions.beginDelete(sessionId)}
		onOpenEditor={() => void store.openSelectedProject()}
		onRefreshEditor={() => void store.refreshProjectStatus()}
		onOpenSettings={() => (settingsOpen = true)}
	>
		<div
			data-ui="app-shell"
			data-left-mode={layout.leftMode}
			data-right-mode={layout.rightMode}
			data-left-visible={layout.leftVisible}
			data-right-visible={layout.rightVisible}
			style={`--sidebar-width:${layout.sidebarWidth}px;--inspector-width:${layout.inspectorWidth}px`}
		>
			<Titlebar
				{agent}
				{layout}
				{store}
				view={unityView}
				onOpenSettings={() => (settingsOpen = true)}
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
				onOpenProjectPicker={() => (sessions.projectPickerOpen = true)}
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

			<Conversation
				{store}
				{layout}
				{drafts}
				agentName={agent.name}
				{currentSession}
				bind:focusComposer
				onRename={() => sessions.beginRename()}
				onCopy={() => void sessions.copyTranscript()}
				onExport={() => void sessions.exportTranscript()}
				onDelete={() => sessions.beginDelete()}
			/>

			<UnityInspector
				{store}
				view={unityView}
				hidden={!layout.rightVisible}
				onOpenProject={() => store.openSelectedProject()}
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

			<AppDialogs {store} {layout} {sessions} bind:settingsOpen />
		</div>
	</AppContextMenu>

	<Toast queue={toasts} />
</Tooltip.Provider>
