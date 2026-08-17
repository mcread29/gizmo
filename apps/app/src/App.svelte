<script lang="ts">
	import type { AgentIdentity } from '@unity-agent/protocol';
	import { onMount, untrack } from 'svelte';
	import {
		AgentStore,
		WebSocketAgentClient,
		type AgentClient,
	} from './lib/agent-client';
	import Conversation from './lib/features/conversation/Conversation.svelte';
	import { formatToolResult } from './lib/features/conversation/format';
	import SessionSidebar from './lib/features/sessions/SessionSidebar.svelte';
	import AppDialogs from './lib/features/shell/AppDialogs.svelte';
	import PanelResizeHandle from './lib/features/shell/PanelResizeHandle.svelte';
	import Titlebar from './lib/features/shell/Titlebar.svelte';
	import UnityInspector from './lib/features/unity/UnityInspector.svelte';
	import { createUnityView } from './lib/features/unity/unity-view';

	interface Props {
		client?: AgentClient;
	}

	let { client = new WebSocketAgentClient() }: Props = $props();

	const agent: AgentIdentity = {
		name: 'Unity Agent',
		version: '0.0.0',
		capabilities: ['editor-status', 'pipeline-commands'],
	};
	const agentStore = new AgentStore(untrack(() => client));

	let theme = $state<'light' | 'dark'>('dark');
	let viewportWidth = $state(Number.POSITIVE_INFINITY);
	let leftCollapsed = $state(false);
	let rightCollapsed = $state(false);
	let leftDrawerOpen = $state(false);
	let rightDrawerOpen = $state(false);
	let leftWidth = $state(248);
	let rightWidth = $state(288);
	let projectDialogOpen = $state(false);
	let settingsDialogOpen = $state(false);
	let renameDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let renameDraft = $state('');
	let leftOverlay = $derived(viewportWidth <= 720);
	let rightOverlay = $derived(viewportWidth <= 1040);
	let leftVisible = $derived(leftOverlay ? leftDrawerOpen : !leftCollapsed);
	let rightVisible = $derived(rightOverlay ? rightDrawerOpen : !rightCollapsed);
	let leftMax = $derived(
		Math.max(
			200,
			Math.min(420, viewportWidth - (rightVisible ? rightWidth : 0) - 420),
		),
	);
	let rightMax = $derived(
		Math.max(
			240,
			Math.min(480, viewportWidth - (leftVisible ? leftWidth : 0) - 420),
		),
	);
	let currentSession = $derived(
		agentStore.sessions.find((session) => session.id === agentStore.sessionId),
	);
	let unityView = $derived(
		createUnityView({
			messages: agentStore.messages,
			projects: agentStore.projects,
			selectedProjectPath: agentStore.selectedProjectPath,
			projectStatus: agentStore.projectStatus,
			projectsLoading: agentStore.projectsLoading,
		}),
	);

	onMount(() => {
		const updateViewport = () => {
			viewportWidth = window.innerWidth;
			if (viewportWidth <= 1040) return;
			const available = viewportWidth - 420;
			if (leftWidth + rightWidth <= available) return;
			rightWidth = Math.max(240, available - leftWidth);
			if (leftWidth + rightWidth > available) {
				leftWidth = Math.max(200, available - rightWidth);
			}
		};
		updateViewport();
		window.addEventListener('resize', updateViewport);
		void agentStore.connect();
		const statusInterval = window.setInterval(
			() => void agentStore.refreshProjectStatus(),
			5_000,
		);
		return () => {
			window.removeEventListener('resize', updateViewport);
			window.clearInterval(statusInterval);
			void agentStore.disconnect();
		};
	});

	$effect(() => {
		document.documentElement.dataset.theme = theme;
	});

	function closeDrawers() {
		leftDrawerOpen = false;
		rightDrawerOpen = false;
	}

	function toggleLeftPanel() {
		if (leftOverlay) {
			leftDrawerOpen = !leftDrawerOpen;
			if (leftDrawerOpen) rightDrawerOpen = false;
		} else {
			leftCollapsed = !leftCollapsed;
		}
	}

	function toggleRightPanel() {
		if (rightOverlay) {
			rightDrawerOpen = !rightDrawerOpen;
			if (rightDrawerOpen) leftDrawerOpen = false;
		} else {
			rightCollapsed = !rightCollapsed;
		}
	}

	async function startThread(projectPath: string) {
		projectDialogOpen = false;
		await agentStore.newSession(projectPath);
	}

	function beginRename() {
		if (!currentSession) return;
		renameDraft = currentSession.title;
		renameDialogOpen = true;
	}

	async function renameSession() {
		if (!currentSession || !renameDraft.trim()) return;
		await agentStore.renameSession(currentSession.id, renameDraft);
		renameDialogOpen = false;
	}

	function exportTranscript() {
		if (!currentSession) return;
		const lines = [`# ${currentSession.title}`, ''];
		for (const message of agentStore.messages) {
			lines.push(`## ${message.role === 'user' ? 'You' : agent.name}`, '');
			if (message.content) lines.push(message.content, '');
			for (const tool of message.tools) {
				lines.push(`- \`${tool.name}\`: ${tool.statusText}`);
				if (tool.result !== undefined) {
					lines.push('', '```json', formatToolResult(tool.result), '```', '');
				}
			}
		}
		const url = URL.createObjectURL(
			new Blob([lines.join('\n')], { type: 'text/markdown' }),
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${safeFileName(currentSession.title)}.md`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function safeFileName(value: string) {
		return (
			value.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'session'
		);
	}

	async function deleteSession() {
		if (!currentSession) return;
		const sessionId = currentSession.id;
		deleteDialogOpen = false;
		await agentStore.deleteSession(sessionId);
	}
</script>

<svelte:head
	><meta
		name="description"
		content="An agent workspace for the Unity Editor"
	/></svelte:head
>

<div
	data-ui="app-shell"
	data-left-visible={leftVisible}
	data-right-visible={rightVisible}
	style={`--sidebar-width:${leftWidth}px;--inspector-width:${rightWidth}px`}
>
	<Titlebar
		{agent}
		{theme}
		view={unityView}
		{leftVisible}
		{rightVisible}
		onToggleLeft={toggleLeftPanel}
		onToggleRight={toggleRightPanel}
		onToggleTheme={() => (theme = theme === 'dark' ? 'light' : 'dark')}
		onOpenSettings={() => (settingsDialogOpen = true)}
	/>

	{#if (leftOverlay && leftDrawerOpen) || (rightOverlay && rightDrawerOpen)}<button
			data-ui="drawer-scrim"
			aria-label="Close navigation panels"
			onclick={closeDrawers}
		></button>{/if}

	<SessionSidebar
		store={agentStore}
		onOpenProjectPicker={() => (projectDialogOpen = true)}
	/>
	{#if leftVisible && !leftOverlay}
		<PanelResizeHandle
			side="left"
			size={leftWidth}
			min={200}
			max={leftMax}
			onResize={(size) => (leftWidth = size)}
			onReset={() => (leftWidth = 248)}
		/>
	{/if}
	<Conversation
		store={agentStore}
		agentName={agent.name}
		{currentSession}
		onRename={beginRename}
		onExport={exportTranscript}
		onDelete={() => (deleteDialogOpen = true)}
	/>
	<UnityInspector
		view={unityView}
		projectError={agentStore.projectError}
		projectOpening={agentStore.projectOpening}
		onOpenProject={() => agentStore.openSelectedProject()}
	/>
	{#if rightVisible && !rightOverlay}
		<PanelResizeHandle
			side="right"
			size={rightWidth}
			min={240}
			max={rightMax}
			onResize={(size) => (rightWidth = size)}
			onReset={() => (rightWidth = 288)}
		/>
	{/if}

	<AppDialogs
		store={agentStore}
		bind:projectOpen={projectDialogOpen}
		bind:settingsOpen={settingsDialogOpen}
		bind:renameOpen={renameDialogOpen}
		bind:deleteOpen={deleteDialogOpen}
		bind:renameDraft
		onStartThread={startThread}
		onRename={renameSession}
		onDelete={deleteSession}
	/>
</div>
