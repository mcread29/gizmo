<script lang="ts">
	import type { AgentSessionSummary } from '@gizmo/protocol';
	import { MessageSquare } from '@lucide/svelte';
	import { formatSessionTime, threadTitle } from './session-groups';

	interface Props {
		session: AgentSessionSummary;
		active: boolean;
		running: boolean;
		onOpen: () => void;
	}

	let { session, active, running, onOpen }: Props = $props();

	let subtitle = $derived(
		`${session.messageCount} ${
			session.messageCount === 1 ? 'message' : 'messages'
		} · ${formatSessionTime(session.lastActiveAt)}`,
	);
</script>

<button
	type="button"
	data-ui="session-item"
	data-context-kind="thread"
	data-context-id={session.id}
	data-active={active || undefined}
	data-running={running || undefined}
	aria-current={active ? 'page' : undefined}
	onclick={onOpen}
>
	<span data-ui="session-icon">
		<MessageSquare size={15} />
		{#if running}
			<span data-ui="session-running"></span>
			<span data-ui="sr-only">· agent working</span>
		{/if}
	</span>
	<span>
		<strong>{threadTitle(session.title)}</strong>
		<small>{subtitle}</small>
	</span>
</button>
