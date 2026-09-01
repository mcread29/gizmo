<script lang="ts">
	import DiscardChangesDialog from './lib/features/settings/DiscardChangesDialog.svelte';
	import {
		UnsavedChangesGuard,
		discardSkillChanges,
	} from './lib/features/settings/unsaved-changes.svelte';
	import './app.css';
	import { formatToolResult } from '@gizmo/design/format';
	import type { AgentIdentity } from '@gizmo/protocol';
	import { Tooltip } from 'bits-ui';
	import { onDestroy, onMount, untrack } from 'svelte';
	import {
		AgentStore,
		WebSocketAgentClient,
		type AgentClient,
	} from './lib/agent-client';
	import { saveAppSettings } from './lib/app-settings';
	import { Toast } from './lib/components';
	import { DraftStore } from './lib/features/conversation/drafts.svelte';
	import { PiExtensionUiStore } from './lib/features/extension-ui/PiExtensionUiStore.svelte';
	import { SessionActions } from './lib/features/sessions/session-actions.svelte';
	import { threadTitle } from './lib/features/sessions/session-groups';
	import AppScreens from './lib/features/shell/AppScreens.svelte';
	import AppWorkspaceShell from './lib/features/shell/AppWorkspaceShell.svelte';
	import { handleShortcut } from './lib/features/shell/shortcuts';
	import { WorkspaceLayout } from './lib/features/shell/workspace.svelte';
	import { AppRouter, type WorkspaceTab } from './lib/router.svelte';
	import { toasts } from './lib/toasts.svelte';

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
	const agentClient = untrack(
		() =>
			client ??
			new WebSocketAgentClient(layout.agentUrl ? { url: layout.agentUrl } : {}),
	);
	const store = new AgentStore(agentClient);
	const sessions = new SessionActions(store, agent.name, toasts);
	const drafts = new DraftStore();
	const extensionUi = new PiExtensionUiStore(agentClient, toasts);
	const router = new AppRouter();

	let focusComposer = $state<() => void>();
	let findInThread = $state<() => void>();
	let focusThreadSearch = $state<() => void>();
	const settingsGuard = new UnsavedChangesGuard();
	let settingsSaveTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingSettings = layout.settings;

	let currentSession = $derived(
		store.sessions.find((session) => session.id === store.sessionId),
	);
	let documentTitle = $derived(
		extensionUi.titleFor(store.sessionId) ??
			(currentSession
				? `${threadTitle(currentSession.title)} — Gizmo`
				: 'Gizmo'),
	);

	// A refresh restores the workspace route from the URL, but the store defaults
	// its selection to the first project. Keep the inspector on the routed one.
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
		extensionUi.start();
		void store.connect();
		return () => {
			window.removeEventListener('resize', measure);
			stopRouting();
			extensionUi.dispose();
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

	function closeSettings() {
		settingsGuard.guard(discardSkillChanges, () => router.close());
	}

	function searchThreads() {
		if (!layout.leftVisible) layout.toggleLeft();
		focusThreadSearch?.();
	}

	function onKeydown(event: KeyboardEvent) {
		if (extensionUi.dialogFor(store.sessionId)) return;
		handleShortcut(event, {
			newThread: () => void startThread(),
			openSettings: () => router.go('settings'),
			openTree: () => router.go('tree'),
			focusComposer: () => focusComposer?.(),
			findInThread: () => findInThread?.(),
			openPalette: () => sessions.openCommandPalette('root'),
			searchThreads,
			toggleLeft: () => layout.toggleLeft(),
			toggleRight: () => layout.toggleRight(),
			dismiss: () => {
				if (sessions.commandPaletteOpen) return;
				if (router.current === 'workspace') layout.closeDrawers();
				else if (router.current === 'settings') closeSettings();
				else router.close();
			},
		});
	}

	/** A workspace route never opens or creates a thread. */
	function showWorkspace(projectPath: string, tab?: WorkspaceTab) {
		router.go('workspace', {
			workspacePath: projectPath,
			...(tab ? { tab } : {}),
		});
		void sessions.selectWorkspace(projectPath);
	}

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

<svelte:head>
	<title>{documentTitle}</title>
	<meta
		name="description"
		content="An extensible agent workspace for software projects"
	/>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<Tooltip.Provider delayDuration={350} skipDelayDuration={300}>
	<AppWorkspaceShell
		{agent}
		{store}
		{sessions}
		{layout}
		{drafts}
		{extensionUi}
		{router}
		bind:focusComposer
		bind:findInThread
		bind:focusThreadSearch
		onCloseSettings={closeSettings}
		onShowWorkspace={showWorkspace}
		onOpenThread={openThread}
		onStartThread={startThread}
		getContextText={contextText}
	/>

	<AppScreens
		{router}
		{layout}
		{store}
		version={agent.version}
		{settingsGuard}
		onShowWorkspaceSettings={(path) => showWorkspace(path, 'configure')}
	/>

	<DiscardChangesDialog guard={settingsGuard} />
	<Toast queue={toasts} />
</Tooltip.Provider>
