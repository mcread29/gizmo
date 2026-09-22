<script lang="ts">
	import type { AgentSessionSummary } from '@gizmo/protocol';
	import {
		CircleAlert,
		CircleHelp,
		LoaderCircle,
		MessageSquare,
	} from '@lucide/svelte';
	import { formatSessionTime, threadTitle } from './session-groups';

	interface Props {
		session: AgentSessionSummary;
		active: boolean;
		running: boolean;
		/** The agent is stopped on a confirmation only the user can give. */
		waiting?: boolean;
		/** The last run ended in an error the thread still shows. */
		failed?: boolean;
		onOpen: () => void;
	}

	let {
		session,
		active,
		running,
		waiting = false,
		failed = false,
		onOpen,
	}: Props = $props();

	// Waiting outranks running: a run stopped on a question is not "working".
	let status = $derived(
		waiting ? 'waiting' : running ? 'running' : failed ? 'error' : undefined,
	);
	let subtitle = $derived(
		status === 'waiting'
			? 'Waiting for your confirmation'
			: status === 'running'
				? 'Agent working…'
				: status === 'error'
					? 'Needs attention'
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
	data-running={status === 'running' || undefined}
	data-status={status}
	aria-current={active ? 'page' : undefined}
	onclick={onOpen}
>
	<!-- The icon is a tile the full height of the row; while the agent works
	     it becomes the working indicator itself rather than a dot beside one. -->
	<span data-ui="session-icon" aria-hidden="true">
		{#if status === 'waiting'}
			<CircleHelp size={15} />
		{:else if status === 'running'}
			<LoaderCircle size={15} data-ui="session-working" />
		{:else if status === 'error'}
			<CircleAlert size={15} />
		{:else}
			<MessageSquare size={15} />
		{/if}
	</span>
	<span>
		<strong>{threadTitle(session.title)}</strong>
		<small>{subtitle}</small>
	</span>
	{#if status}<span data-ui="sr-only">{subtitle}</span>{/if}
</button>
