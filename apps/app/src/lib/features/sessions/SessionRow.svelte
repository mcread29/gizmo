<script lang="ts">
	import type { AgentSessionSummary } from '@gizmo/protocol';
	import { LoaderCircle, MessageSquare } from '@lucide/svelte';
	import { formatSessionTime, threadTitle } from './session-groups';

	interface Props {
		session: AgentSessionSummary;
		active: boolean;
		running: boolean;
		onOpen: () => void;
	}

	let { session, active, running, onOpen }: Props = $props();

	let subtitle = $derived(
		running
			? 'Agent working…'
			: `${session.messageCount} ${
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
	<!-- The icon is a tile the full height of the row; while the agent works
	     it becomes the working indicator itself rather than a dot beside one. -->
	<span data-ui="session-icon" aria-hidden="true">
		{#if running}
			<LoaderCircle size={15} data-ui="session-working" />
		{:else}
			<MessageSquare size={15} />
		{/if}
	</span>
	<span>
		<strong>{threadTitle(session.title)}</strong>
		<small>{subtitle}</small>
	</span>
	{#if running}<span data-ui="sr-only">Agent working</span>{/if}
</button>
