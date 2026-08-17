<script lang="ts">
	import { agentToolPolicy, type AgentIdentity } from '@unity-agent/protocol';
	import {
		Bot,
		ChevronDown,
		CircleCheck,
		CircleDashed,
		CircleX,
		FolderOpen,
		MessageSquare,
		Moon,
		MoreHorizontal,
		PanelLeft,
		PanelRight,
		Plus,
		Send,
		Settings,
		Sparkles,
		Square,
		Sun,
		Terminal,
		User,
	} from '@lucide/svelte';
	import { onMount, untrack } from 'svelte';
	import {
		AgentStore,
		WebSocketAgentClient,
		type AgentClient,
		type ToolCallView,
	} from './lib/agent-client';
	import {
		Button,
		Dialog,
		Menu,
		ScrollPanel,
		Tabs,
		Tooltip,
	} from './lib/components';
	import ComponentGallery from './lib/components/ComponentGallery.svelte';

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
	let inspectorTab = $state('editor');
	let draft = $state('');
	let toolActivity = $derived(
		agentStore.messages.flatMap((message) => message.tools),
	);
	let selectedProject = $derived(
		agentStore.projects.find(
			(project) => project.path === agentStore.selectedProjectPath,
		),
	);
	let currentSession = $derived(
		agentStore.sessions.find((session) => session.id === agentStore.sessionId),
	);
	let unityStatus = $derived(
		agentStore.projectStatus ?? findUnityStatus(toolActivity),
	);
	let unityCommands = $derived(findUnityCommands(toolActivity));
	let unityCommandNames = $derived(
		unityCommands?.commands
			.map(commandName)
			.filter((name) => name !== undefined) ?? [],
	);
	let editor = $derived(unityStatus?.instances[0]);
	let editorProjectPath = $derived(
		readEditorValue(editor, ['projectPath', 'project']) ??
			selectedProject?.path,
	);
	let editorProjectName = $derived(
		selectedProject?.title ??
			readEditorValue(editor, ['projectName', 'name']) ??
			projectName(editorProjectPath) ??
			(agentStore.projectsLoading ? 'Loading projects' : 'Select a project'),
	);
	let editorVersion = $derived(
		readEditorValue(editor, ['version', 'unityVersion']) ??
			selectedProject?.version,
	);
	let editorState = $derived(
		readEditorValue(editor, ['state', 'connectionState']) ??
			statusLabel(unityStatus?.state),
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

	function sendPrompt() {
		if (!draft.trim() || agentStore.sessionState === 'streaming') return;
		const prompt = draft;
		draft = '';
		void agentStore.prompt(prompt);
	}

	function handleComposerKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendPrompt();
		}
	}

	function formatTime(timestamp: number) {
		return new Intl.DateTimeFormat([], {
			hour: '2-digit',
			minute: '2-digit',
		}).format(timestamp);
	}

	function formatSessionTime(timestamp: number) {
		const elapsedMinutes = Math.floor((Date.now() - timestamp) / 60_000);
		if (elapsedMinutes < 1) return 'Now';
		if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
		return new Intl.DateTimeFormat([], {
			month: 'short',
			day: 'numeric',
		}).format(timestamp);
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

	function renameSession() {
		if (!currentSession || !renameDraft.trim()) return;
		agentStore.renameSession(currentSession.id, renameDraft);
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

	function formatToolResult(result: unknown) {
		if (!result) return '';
		if (typeof result === 'string') return result;
		return JSON.stringify(result);
	}

	interface UnityStatusView {
		state: 'connected' | 'disconnected' | 'unavailable' | 'error';
		instances: Record<string, unknown>[];
		errors: { code: string; message: string }[];
	}

	interface UnityCommandsView {
		state: 'available' | 'disconnected' | 'unavailable' | 'error';
		commands: unknown[];
		errors: { code: string; message: string }[];
	}

	function findUnityStatus(tools: ToolCallView[]): UnityStatusView | undefined {
		for (let index = tools.length - 1; index >= 0; index--) {
			const tool = tools[index];
			if (tool.name !== 'unity_status' || !isUnityStatus(tool.result)) continue;
			return tool.result;
		}
	}

	function isUnityStatus(value: unknown): value is UnityStatusView {
		if (!value || typeof value !== 'object') return false;
		const state = 'state' in value ? value.state : undefined;
		return (
			(state === 'connected' ||
				state === 'disconnected' ||
				state === 'unavailable' ||
				state === 'error') &&
			'instances' in value &&
			Array.isArray(value.instances) &&
			'errors' in value &&
			Array.isArray(value.errors)
		);
	}

	function findUnityCommands(
		tools: ToolCallView[],
	): UnityCommandsView | undefined {
		for (let index = tools.length - 1; index >= 0; index--) {
			const tool = tools[index];
			if (tool.name !== 'unity_list_commands' || !isUnityCommands(tool.result))
				continue;
			return tool.result;
		}
	}

	function isUnityCommands(value: unknown): value is UnityCommandsView {
		if (!value || typeof value !== 'object') return false;
		const state = 'state' in value ? value.state : undefined;
		return (
			(state === 'available' ||
				state === 'disconnected' ||
				state === 'unavailable' ||
				state === 'error') &&
			'commands' in value &&
			Array.isArray(value.commands) &&
			'errors' in value &&
			Array.isArray(value.errors)
		);
	}

	function commandName(command: unknown): string | undefined {
		if (typeof command === 'string') return command;
		if (!command || typeof command !== 'object') return;
		const record = command as Record<string, unknown>;
		for (const key of ['name', 'command', 'id']) {
			if (typeof record[key] === 'string') return record[key];
		}
	}

	function readEditorValue(
		instance: Record<string, unknown> | undefined,
		keys: string[],
	): string | undefined {
		if (!instance) return;
		for (const key of keys) {
			const value = instance[key];
			if (typeof value === 'string' || typeof value === 'number') {
				return String(value);
			}
		}
	}

	function projectName(path: string | undefined): string | undefined {
		return path?.split(/[\\/]/).filter(Boolean).at(-1);
	}

	function statusLabel(state: UnityStatusView['state'] | undefined): string {
		switch (state) {
			case 'connected':
				return 'Ready';
			case 'disconnected':
				return 'Disconnected';
			case 'unavailable':
				return 'CLI unavailable';
			case 'error':
				return 'Check failed';
			default:
				return 'Not checked';
		}
	}
</script>

<svelte:head
	><meta
		name="description"
		content="An agent workspace for the Unity Editor"
	/></svelte:head
>

<div data-ui="app-shell" data-left-open={leftOpen} data-right-open={rightOpen}>
	<header data-ui="titlebar">
		<div data-ui="titlebar-start">
			<Tooltip text="Toggle session sidebar">
				{#snippet children(props)}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						aria-label="Toggle session sidebar"
						onclick={() => (leftOpen = !leftOpen)}
					>
						<PanelLeft size={17} />
					</Button>
				{/snippet}
			</Tooltip>
			<div data-ui="brand-mark"><Sparkles size={15} /></div>
			<strong>{agent.name}</strong>
			<span data-ui="preview-badge">Preview</span>
		</div>
		<div data-ui="titlebar-center">
			<span data-ui="project-dot" data-state={unityStatus?.state}></span>
			<span>{editorProjectName}</span>
			<span data-ui="muted"
				>{editorVersion ? `Unity ${editorVersion}` : editorState}</span
			>
		</div>
		<div data-ui="titlebar-end">
			<Tooltip text={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>
				{#snippet children(props)}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						aria-label="Toggle color theme"
						onclick={() => (theme = theme === 'dark' ? 'light' : 'dark')}
					>
						{#if theme === 'dark'}<Sun size={17} />{:else}<Moon
								size={17}
							/>{/if}
					</Button>
				{/snippet}
			</Tooltip>
			<Button
				variant="ghost"
				size="icon"
				aria-label="Settings"
				onclick={() => (settingsDialogOpen = true)}
				><Settings size={17} /></Button
			>
			<Tooltip text="Toggle editor inspector">
				{#snippet children(props)}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						aria-label="Toggle editor inspector"
						onclick={() => (rightOpen = !rightOpen)}
					>
						<PanelRight size={17} />
					</Button>
				{/snippet}
			</Tooltip>
		</div>
	</header>

	{#if leftOpen || rightOpen}<button
			data-ui="drawer-scrim"
			aria-label="Close navigation panels"
			onclick={closeDrawers}
		></button>{/if}

	<aside data-ui="sidebar" aria-label="Sessions">
		<div data-ui="sidebar-header">
			<span data-ui="eyebrow">Workspace</span>
			<Button
				variant="secondary"
				size="sm"
				disabled={agentStore.connection !== 'connected' ||
					!agentStore.sessionId ||
					agentStore.sessionState === 'streaming'}
				onclick={() => agentStore.newSession()}
				><Plus size={14} /> New session</Button
			>
		</div>

		<button data-ui="project-card" onclick={() => (projectDialogOpen = true)}>
			<span data-ui="project-icon"><FolderOpen size={17} /></span>
			<span
				><strong>{selectedProject?.title ?? 'Select a project'}</strong><small
					>{selectedProject?.path ?? 'No registered project selected'}</small
				></span
			>
			<ChevronDown size={14} />
		</button>

		<div data-ui="section-label">
			<span>Recent sessions</span><span>{agentStore.sessions.length}</span>
		</div>
		<ScrollPanel data-ui="session-scroll">
			<nav data-ui="session-list" aria-label="Recent sessions">
				{#each agentStore.sessions as session (session.id)}
					<button
						type="button"
						data-ui="session-item"
						data-active={session.id === agentStore.sessionId || undefined}
						aria-current={session.id === agentStore.sessionId
							? 'page'
							: undefined}
						onclick={() => agentStore.switchSession(session.id)}
					>
						<MessageSquare size={15} />
						<span
							><strong>{session.title}</strong><small
								>{formatSessionTime(session.lastActiveAt)}</small
							></span
						>
					</button>
				{/each}
			</nav>
		</ScrollPanel>

		<div data-ui="sidebar-footer">
			<ComponentGallery />
			<div data-ui="connection-row">
				<span data-ui="status-dot" data-status={agentStore.connection}></span>
				{agentStore.connection === 'connected'
					? 'Local agent ready'
					: agentStore.connection === 'connecting'
						? 'Connecting to agent'
						: 'Local agent offline'}
			</div>
		</div>
	</aside>

	<main id="conversation" data-ui="conversation" tabindex="-1">
		<div data-ui="conversation-header">
			<div>
				<span data-ui="eyebrow">Session</span>
				<h1>{currentSession?.title ?? 'New session'}</h1>
			</div>
			<Menu
				items={[
					{ label: 'Rename', onSelect: beginRename },
					{ label: 'Export transcript', onSelect: exportTranscript },
					{
						label: 'Delete',
						tone: 'danger',
						disabled: agentStore.sessionState === 'streaming',
						onSelect: () => (deleteDialogOpen = true),
					},
				]}
			>
				{#snippet trigger(props)}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						aria-label="Session actions"><MoreHorizontal size={18} /></Button
					>
				{/snippet}
			</Menu>
		</div>

		<ScrollPanel data-ui="messages">
			<div data-ui="message-list">
				{#if agentStore.error}
					<div data-ui="error-banner" role="alert">
						<CircleX size={17} />{agentStore.error}
					</div>
				{/if}
				{#if agentStore.messages.length === 0}
					<div data-ui="conversation-empty">
						<div data-ui="brand-mark"><Sparkles size={18} /></div>
						<h2>Ready when you are</h2>
						<p>
							Ask about the open project, inspect the Editor, or run a
							registered command.
						</p>
					</div>
				{/if}
				{#each agentStore.messages as message (message.id)}
					<div data-ui="message" data-role={message.role}>
						<div data-ui="avatar">
							{#if message.role === 'user'}<User size={15} />{:else}<Bot
									size={15}
								/>{/if}
						</div>
						<div data-ui="message-body">
							<div data-ui="message-meta">
								<strong>{message.role === 'user' ? 'You' : agent.name}</strong>
								<span>{formatTime(message.createdAt)}</span>
							</div>
							{#if message.content}<p>{message.content}</p>{/if}
							{#each message.tools as tool (tool.id)}
								<div data-ui="tool-call" data-state={tool.status}>
									<div data-ui="tool-header">
										<Terminal size={15} /><strong>{tool.name}</strong>
										{#if tool.status === 'running'}
											<CircleDashed data-ui="spinner" size={15} />
										{:else if tool.status === 'complete'}
											<CircleCheck size={15} />
										{:else}
											<CircleX size={15} />
										{/if}
									</div>
									<div data-ui="tool-result">
										<span>{tool.statusText}</span><code
											>{formatToolResult(tool.result)}</code
										>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</ScrollPanel>

		<div data-ui="composer-wrap">
			<form
				data-ui="composer"
				onsubmit={(event) => {
					event.preventDefault();
					sendPrompt();
				}}
			>
				<label for="prompt" data-ui="sr-only">Message Unity Agent</label>
				<textarea
					id="prompt"
					bind:value={draft}
					onkeydown={handleComposerKeydown}
					rows="1"
					placeholder="Ask about your Unity project…"></textarea>
				<div data-ui="composer-toolbar">
					<span data-ui="model-indicator">
						{agentStore.model
							? `${agentStore.model.provider} / ${agentStore.model.id}`
							: 'Pi default model'}
					</span>
					<span data-ui="composer-hint"
						><kbd>Enter</kbd> send · <kbd>Shift Enter</kbd> newline</span
					>
					{#if agentStore.sessionState === 'streaming'}
						<Button
							type="button"
							variant="danger"
							size="icon"
							aria-label="Stop response"
							onclick={() => agentStore.abort()}
						>
							<Square size={14} />
						</Button>
					{:else}
						<Button
							type="submit"
							variant="primary"
							size="icon"
							aria-label="Send message"
							disabled={!draft.trim() ||
								agentStore.connection !== 'connected' ||
								!agentStore.sessionId}
						>
							<Send size={16} />
						</Button>
					{/if}
				</div>
			</form>
			<p data-ui="disclaimer">
				Unity Agent can modify your project. Review changes before committing.
			</p>
		</div>
	</main>

	<aside data-ui="inspector" aria-label="Unity Editor inspector">
		<div data-ui="inspector-header">
			<div>
				<span data-ui="eyebrow">Unity Editor</span>
				<h2>{editorProjectName}</h2>
			</div>
			<span data-ui="status-pill" data-state={unityStatus?.state ?? 'unchecked'}
				><span></span>{statusLabel(unityStatus?.state)}</span
			>
		</div>

		<Tabs
			items={[
				{ value: 'editor', label: 'Editor' },
				{ value: 'activity', label: 'Activity' },
			]}
			bind:value={inspectorTab}
		>
			{#snippet children(value)}
				{#if value === 'editor'}
					<div data-ui="inspector-stack">
						<section data-ui="inspector-card">
							<div data-ui="card-label">Runtime</div>
							<dl>
								<div>
									<dt>State</dt>
									<dd>
										<span
											data-ui="status-dot"
											data-status={unityStatus?.state === 'connected'
												? 'online'
												: 'disconnected'}
										></span>{editorState}
									</dd>
								</div>
								<div>
									<dt>Version</dt>
									<dd>{editorVersion ?? '—'}</dd>
								</div>
								<div>
									<dt>Pipeline</dt>
									<dd>
										{unityStatus?.state === 'connected' ? 'Connected' : '—'}
									</dd>
								</div>
							</dl>
						</section>
						<section data-ui="inspector-card">
							<div data-ui="card-label">Connection</div>
							{#if editor}
								<dl>
									<div>
										<dt>Project</dt>
										<dd>{editorProjectPath ?? '—'}</dd>
									</div>
									<div>
										<dt>Port</dt>
										<dd>{readEditorValue(editor, ['port']) ?? '—'}</dd>
									</div>
									<div>
										<dt>Process</dt>
										<dd>
											{readEditorValue(editor, ['pid', 'processId']) ?? '—'}
										</dd>
									</div>
								</dl>
							{:else}
								<p data-ui="inspector-message">
									{agentStore.projectError ??
										unityStatus?.errors[0]?.message ??
										'The selected project Editor is not open.'}
								</p>
								{#if selectedProject}
									<Button
										variant="primary"
										size="sm"
										disabled={agentStore.projectOpening}
										onclick={() => agentStore.openSelectedProject()}
										><FolderOpen size={14} />{agentStore.projectOpening
											? 'Opening Editor…'
											: 'Open Editor'}</Button
									>
								{/if}
							{/if}
						</section>
						<section data-ui="inspector-card">
							<div data-ui="card-label">
								Available commands
								<span>{unityCommands ? unityCommandNames.length : '—'}</span>
							</div>
							{#if unityCommandNames.length > 0}
								<div data-ui="command-list">
									{#each unityCommandNames as name}<code>{name}</code>{/each}
								</div>
							{:else}
								<p data-ui="inspector-message">
									{unityCommands?.errors[0]?.message ??
										'Ask the agent to list registered Unity commands.'}
								</p>
							{/if}
						</section>
					</div>
				{:else if toolActivity.length === 0}
					<div data-ui="empty-state">
						<CircleCheck size={22} /><strong>All caught up</strong><span
							>Tool activity will appear here.</span
						>
					</div>
				{:else}
					<div data-ui="activity-list">
						{#each toolActivity as tool (tool.id)}
							<div data-ui="activity-item" data-state={tool.status}>
								<Terminal size={14} /><span
									><strong>{tool.name}</strong><small>{tool.statusText}</small
									></span
								>
							</div>
						{/each}
					</div>
				{/if}
			{/snippet}
		</Tabs>
	</aside>

	<Dialog
		bind:open={projectDialogOpen}
		title="Open a Unity project"
		description="Choose the project this session can inspect and modify"
	>
		{#snippet trigger(props)}<button
				{...props}
				data-ui="hidden-trigger"
				tabindex="-1">Open project</button
			>{/snippet}
		<div data-ui="project-picker">
			{#if agentStore.projectsLoading}
				<p data-ui="inspector-message">Loading registered projects…</p>
			{:else if agentStore.projects.length === 0}
				<p data-ui="inspector-message">
					{agentStore.projectError ?? 'No registered Unity projects found.'}
				</p>
			{:else}
				{#each agentStore.projects as project (project.path)}
					<button
						data-ui="project-option"
						onclick={() => selectProject(project.path)}
						><FolderOpen size={19} /><span
							><strong>{project.title}</strong><small>{project.path}</small
							></span
						>{#if project.path === agentStore.selectedProjectPath}<CircleCheck
								size={17}
							/>{/if}</button
					>
				{/each}
			{/if}
		</div>
	</Dialog>

	<Dialog
		bind:open={settingsDialogOpen}
		title="Agent settings"
		description="Runtime configuration loaded by the local Pi agent"
	>
		{#snippet trigger(props)}
			<button {...props} data-ui="hidden-trigger" tabindex="-1"
				>Open settings</button
			>
		{/snippet}
		<div data-ui="settings-list">
			<div>
				<span>Provider</span><strong
					>{agentStore.model?.provider ?? 'Pi default'}</strong
				>
			</div>
			<div>
				<span>Model</span><strong
					>{agentStore.model?.id ?? 'Resolved on session start'}</strong
				>
			</div>
			<div>
				<span>Thinking</span><strong
					>{agentStore.model?.thinkingLevel ?? 'Default'}</strong
				>
			</div>
			<div>
				<span>Authentication</span><strong>Managed by Pi</strong>
			</div>
			<div>
				<span>Tools</span><strong
					>{(agentStore.activeTools.length
						? agentStore.activeTools
						: agentToolPolicy.tools
					).join(', ')}</strong
				>
			</div>
			<div>
				<span>Approvals</span><strong>Full access</strong>
			</div>
			<div>
				<span>Installed extensions</span><strong>Disabled</strong>
			</div>
			<p>
				Credentials stay in the local Pi configuration and are never sent to the
				browser. Start <code>pi</code>, then use <code>/login</code> to change accounts.
				The listed tools execute without approval prompts.
			</p>
		</div>
	</Dialog>

	<Dialog
		bind:open={renameDialogOpen}
		title="Rename session"
		description="Choose a name for this local session"
	>
		{#snippet trigger(props)}
			<button {...props} data-ui="hidden-trigger" tabindex="-1"
				>Rename session</button
			>
		{/snippet}
		<form
			data-ui="dialog-form"
			onsubmit={(event) => {
				event.preventDefault();
				renameSession();
			}}
		>
			<label for="session-title">Session name</label>
			<input id="session-title" bind:value={renameDraft} autocomplete="off" />
			<div data-ui="dialog-actions">
				<Button type="submit" variant="primary" disabled={!renameDraft.trim()}
					>Rename</Button
				>
			</div>
		</form>
	</Dialog>

	<Dialog
		bind:open={deleteDialogOpen}
		title="Delete session?"
		description="This removes the in-memory transcript and cannot be undone."
	>
		{#snippet trigger(props)}
			<button {...props} data-ui="hidden-trigger" tabindex="-1"
				>Delete session</button
			>
		{/snippet}
		<div data-ui="dialog-actions">
			<Button variant="danger" onclick={deleteSession}>Delete session</Button>
		</div>
	</Dialog>
</div>
