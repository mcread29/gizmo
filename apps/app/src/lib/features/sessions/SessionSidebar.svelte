<script lang="ts">
	import { MessageSquare, Plus } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ScrollPanel } from '../../components';
	import ComponentGallery from '../../components/ComponentGallery.svelte';

	interface Props {
		store: AgentStore;
		onOpenProjectPicker: () => void;
	}

	let { store, onOpenProjectPicker }: Props = $props();

	function formatSessionTime(timestamp: number) {
		const elapsedMinutes = Math.floor((Date.now() - timestamp) / 60_000);
		if (elapsedMinutes < 1) return 'Now';
		if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
		return new Intl.DateTimeFormat([], {
			month: 'short',
			day: 'numeric',
		}).format(timestamp);
	}

	function workspaceName(projectPath: string | undefined) {
		return (
			store.projects.find((project) => project.path === projectPath)?.title ??
			projectPath?.split(/[\\/]/).filter(Boolean).at(-1) ??
			'No workspace'
		);
	}
</script>

<aside data-ui="sidebar" aria-label="Threads">
	<div data-ui="sidebar-header">
		<span data-ui="eyebrow">Threads</span>
		<Button
			variant="secondary"
			size="sm"
			disabled={store.connection !== 'connected' ||
				store.projects.length === 0 ||
				store.sessionState === 'streaming'}
			onclick={onOpenProjectPicker}><Plus size={14} /> New thread</Button
		>
	</div>

	<div data-ui="section-label">
		<span>Recent threads</span><span>{store.sessions.length}</span>
	</div>
	<ScrollPanel data-ui="session-scroll">
		<nav data-ui="session-list" aria-label="Recent threads">
			{#each store.sessions as session (session.id)}
				<button
					type="button"
					data-ui="session-item"
					data-context-kind="thread"
					data-context-id={session.id}
					data-active={session.id === store.sessionId || undefined}
					aria-current={session.id === store.sessionId ? 'page' : undefined}
					onclick={() => store.switchSession(session.id)}
				>
					<MessageSquare size={15} />
					<span>
						<strong
							>{session.title === 'New session'
								? 'New thread'
								: session.title}</strong
						>
						<small title={session.projectPath}
							>{workspaceName(session.projectPath)} · {formatSessionTime(
								session.lastActiveAt,
							)}</small
						>
					</span>
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
