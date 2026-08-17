<script lang="ts">
	import type { UnityProject } from '@unity-agent/protocol';
	import { ChevronDown, FolderOpen, MessageSquare, Plus } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ScrollPanel } from '../../components';
	import ComponentGallery from '../../components/ComponentGallery.svelte';

	interface Props {
		store: AgentStore;
		selectedProject?: UnityProject;
		onOpenProjectPicker: () => void;
	}

	let { store, selectedProject, onOpenProjectPicker }: Props = $props();

	function formatSessionTime(timestamp: number) {
		const elapsedMinutes = Math.floor((Date.now() - timestamp) / 60_000);
		if (elapsedMinutes < 1) return 'Now';
		if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
		return new Intl.DateTimeFormat([], {
			month: 'short',
			day: 'numeric',
		}).format(timestamp);
	}
</script>

<aside data-ui="sidebar" aria-label="Sessions">
	<div data-ui="sidebar-header">
		<span data-ui="eyebrow">Workspace</span>
		<Button
			variant="secondary"
			size="sm"
			disabled={store.connection !== 'connected' ||
				!store.sessionId ||
				store.sessionState === 'streaming'}
			onclick={() => store.newSession()}><Plus size={14} /> New session</Button
		>
	</div>

	<button data-ui="project-card" onclick={onOpenProjectPicker}>
		<span data-ui="project-icon"><FolderOpen size={17} /></span>
		<span
			><strong>{selectedProject?.title ?? 'Select a project'}</strong><small
				>{selectedProject?.path ?? 'No registered project selected'}</small
			></span
		>
		<ChevronDown size={14} />
	</button>

	<div data-ui="section-label">
		<span>Recent sessions</span><span>{store.sessions.length}</span>
	</div>
	<ScrollPanel data-ui="session-scroll">
		<nav data-ui="session-list" aria-label="Recent sessions">
			{#each store.sessions as session (session.id)}
				<button
					type="button"
					data-ui="session-item"
					data-active={session.id === store.sessionId || undefined}
					aria-current={session.id === store.sessionId ? 'page' : undefined}
					onclick={() => store.switchSession(session.id)}
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
		{#if import.meta.env.DEV}<ComponentGallery />{/if}
		<div data-ui="connection-row">
			<span data-ui="status-dot" data-status={store.connection}></span>
			{store.connection === 'connected'
				? 'Local agent ready'
				: store.connection === 'connecting'
					? 'Connecting to agent'
					: 'Local agent offline'}
		</div>
	</div>
</aside>
