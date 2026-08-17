<script lang="ts">
	import type { AgentIdentity } from '@unity-agent/protocol';
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
	let inspectorTab = $state('editor');
	let draft = $state('');
	let toolActivity = $derived(
		agentStore.messages.flatMap((message) => message.tools),
	);

	onMount(() => {
		void agentStore.connect();
		return () => void agentStore.disconnect();
	});

	$effect(() => {
		document.documentElement.dataset.theme = theme;
	});

	const sessions = [
		{ title: 'Character controller', detail: '2m ago', active: true },
		{ title: 'Validate scene lighting', detail: 'Yesterday', active: false },
		{ title: 'Prefab cleanup', detail: 'Mon', active: false },
	];

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

	function formatToolResult(result: unknown) {
		if (!result) return '';
		if (typeof result === 'string') return result;
		return JSON.stringify(result);
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
			<span data-ui="project-dot"></span>
			<span>ThirdPersonSandbox</span>
			<span data-ui="muted">Unity 6.3</span>
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
			<Button variant="ghost" size="icon" aria-label="Settings"
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
			<Button variant="secondary" size="sm"
				><Plus size={14} /> New session</Button
			>
		</div>

		<button data-ui="project-card" onclick={() => (projectDialogOpen = true)}>
			<span data-ui="project-icon"><FolderOpen size={17} /></span>
			<span
				><strong>ThirdPersonSandbox</strong><small
					>~/Projects/third-person</small
				></span
			>
			<ChevronDown size={14} />
		</button>

		<div data-ui="section-label">
			<span>Recent sessions</span><span>{sessions.length}</span>
		</div>
		<ScrollPanel data-ui="session-scroll">
			<nav data-ui="session-list" aria-label="Recent sessions">
				{#each sessions as session}
					<a
						href="#conversation"
						data-ui="session-item"
						data-active={session.active || undefined}
						aria-current={session.active ? 'page' : undefined}
					>
						<MessageSquare size={15} />
						<span
							><strong>{session.title}</strong><small>{session.detail}</small
							></span
						>
					</a>
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
				<h1>Character controller</h1>
			</div>
			<Menu
				items={[
					{ label: 'Rename' },
					{ label: 'Export transcript' },
					{ label: 'Delete', tone: 'danger' },
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
							disabled={!draft.trim() || agentStore.connection !== 'connected'}
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
				<span data-ui="eyebrow">Connected Editor</span>
				<h2>ThirdPersonSandbox</h2>
			</div>
			<span data-ui="status-pill"><span></span> Live</span>
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
										<span data-ui="status-dot" data-status="online"></span> Ready
									</dd>
								</div>
								<div>
									<dt>Version</dt>
									<dd>6000.3.7f1</dd>
								</div>
								<div>
									<dt>Pipeline</dt>
									<dd>Installed</dd>
								</div>
							</dl>
						</section>
						<section data-ui="inspector-card">
							<div data-ui="card-label">Available commands <span>12</span></div>
							<div data-ui="command-list">
								<code>scene.validate</code><code
									>character-controller.describe</code
								><code>assets.find-missing</code>
							</div>
							<Button variant="ghost" size="sm">View all commands</Button>
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
			<button
				data-ui="project-option"
				onclick={() => (projectDialogOpen = false)}
				><FolderOpen size={19} /><span
					><strong>ThirdPersonSandbox</strong><small
						>~/Projects/third-person</small
					></span
				><CircleCheck size={17} /></button
			>
			<button
				data-ui="project-option"
				onclick={() => (projectDialogOpen = false)}
				><FolderOpen size={19} /><span
					><strong>RenderingPlayground</strong><small
						>~/Projects/rendering</small
					></span
				></button
			>
		</div>
	</Dialog>
</div>
