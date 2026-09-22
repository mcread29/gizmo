<script lang="ts">
	import { MessageSquare, Terminal } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { threadTitle } from '../sessions/session-groups';

	interface Props {
		store: AgentStore;
		workspaceLabel?: string;
		onCommand: (name: string) => void;
	}

	let { store, workspaceLabel, onCommand }: Props = $props();

	// Other threads in this workspace, newest first: a quick way back into
	// work in progress when a new thread turns out not to be what was wanted.
	let recent = $derived.by(() => {
		const path = store.selectedProjectPath;
		if (!path) return [];
		return store.sessions
			.filter(
				(session) =>
					session.id !== store.sessionId &&
					session.messageCount > 0 &&
					(session.workspacePath ?? session.projectPath) === path,
			)
			.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
			.slice(0, 4);
	});

	let commands = $derived(store.commands.slice(0, 4));
</script>

<div data-ui="thread-empty">
	<div data-ui="thread-empty-intro">
		<strong>Start a thread</strong>
		<span
			>{workspaceLabel
				? `Ask about ${workspaceLabel}, or pick up where you left off.`
				: 'Ask about your workspace to start.'}</span
		>
	</div>
	{#if recent.length || commands.length}
		<div data-ui="thread-starters">
			{#if recent.length}
				<section data-ui="thread-starter-group">
					<h2>Recent threads</h2>
					{#each recent as session (session.id)}
						<button
							type="button"
							data-ui="thread-starter"
							onclick={() => void store.switchSession(session.id)}
						>
							<MessageSquare size={14} />
							<span>{threadTitle(session.title)}</span>
						</button>
					{/each}
				</section>
			{/if}
			{#if commands.length}
				<section data-ui="thread-starter-group">
					<h2>Commands</h2>
					{#each commands as command (command.name)}
						<button
							type="button"
							data-ui="thread-starter"
							title={command.description}
							onclick={() => onCommand(command.name)}
						>
							<Terminal size={14} />
							<span
								><code>/{command.name}</code>
								{#if command.description}<small>{command.description}</small
									>{/if}</span
							>
						</button>
					{/each}
				</section>
			{/if}
		</div>
	{/if}
</div>
