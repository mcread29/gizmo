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
	let leftOpen = $state(false);
	let rightOpen = $state(false);
	let projectDialogOpen = $state(false);
	let settingsDialogOpen = $state(false);
	let renameDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let renameDraft = $state('');
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
		void agentStore.connect();
		const statusInterval = window.setInterval(
			() => void agentStore.refreshProjectStatus(),
			5_000,
		);
		return () => {
			window.clearInterval(statusInterval);
			void agentStore.disconnect();
		};
	});

	$effect(() => {
		document.documentElement.dataset.theme = theme;
	});

	function closeDrawers() {
		leftOpen = false;
		rightOpen = false;
	}

	async function selectProject(projectPath: string) {
		projectDialogOpen = false;
		await agentStore.selectProject(projectPath);
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

<div data-ui="app-shell" data-left-open={leftOpen} data-right-open={rightOpen}>
	<Titlebar
		{agent}
		{theme}
		view={unityView}
		onToggleLeft={() => (leftOpen = !leftOpen)}
		onToggleRight={() => (rightOpen = !rightOpen)}
		onToggleTheme={() => (theme = theme === 'dark' ? 'light' : 'dark')}
		onOpenSettings={() => (settingsDialogOpen = true)}
	/>

	{#if leftOpen || rightOpen}<button
			data-ui="drawer-scrim"
			aria-label="Close navigation panels"
			onclick={closeDrawers}
		></button>{/if}

	<SessionSidebar
		store={agentStore}
		selectedProject={unityView.selectedProject}
		onOpenProjectPicker={() => (projectDialogOpen = true)}
	/>
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

	<AppDialogs
		store={agentStore}
		bind:projectOpen={projectDialogOpen}
		bind:settingsOpen={settingsDialogOpen}
		bind:renameOpen={renameDialogOpen}
		bind:deleteOpen={deleteDialogOpen}
		bind:renameDraft
		onSelectProject={selectProject}
		onRename={renameSession}
		onDelete={deleteSession}
	/>
</div>
