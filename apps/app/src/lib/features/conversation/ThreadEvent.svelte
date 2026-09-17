<script lang="ts">
	import { CornerDownLeft, LoaderCircle, Minimize2 } from '@lucide/svelte';
	import { formatMessageTime } from '@gizmo/design/format';
	import MarkdownContent from './MarkdownContent.svelte';
	import type { MessageRow } from './message-rows';
	import { formatTokens } from './usage';

	/** A row about the thread rather than a turn in it. */
	let { row }: { row: MessageRow } = $props();

	let event = $derived(row.messages[0]?.event);
	let showSummary = $state(false);

	let title = $derived.by(() => {
		switch (event?.reason) {
			case 'threshold':
				return 'Context compacted automatically';
			case 'overflow':
				return 'Context compacted after reaching the model limit';
			default:
				return 'Context compacted';
		}
	});
	let detail = $derived(
		event?.tokensBefore
			? `${formatTokens(event.tokensBefore)} tokens of earlier history were summarized`
			: 'Earlier history was summarized',
	);
</script>

{#if row.kind === 'compacting'}
	<div data-ui="thread-event" data-kind="compacting" role="status">
		<LoaderCircle data-ui="spinner" size={14} aria-hidden="true" />
		<span>
			<strong>Compacting context…</strong>
			<small
				>Older history is being summarized. Sending resumes when it finishes.</small
			>
		</span>
	</div>
{:else if row.kind === 'queued' && row.pending}
	<!-- Looks like the user's own bubble, because it will be one; the dashed
	     edge and caption say it has not been delivered yet. -->
	<div
		data-ui="thread-event"
		data-kind="queued"
		data-context-kind="message"
		data-context-id={row.id}
		data-context-label="queued message"
		data-context-value={row.pending.text}
	>
		<span>
			<small>
				<CornerDownLeft size={12} aria-hidden="true" />
				{row.pending.delivery === 'steer'
					? 'Queued · steers the response at its next step'
					: 'Queued · sent once this response finishes'}
			</small>
			<p>{row.pending.text}</p>
		</span>
	</div>
{:else if event?.kind === 'compaction'}
	<div
		data-ui="thread-event"
		data-kind="compaction"
		data-context-kind="message"
		data-context-id={row.id}
		data-context-label="compaction summary"
		data-context-value={event.summary}
	>
		<Minimize2 size={14} aria-hidden="true" />
		<span>
			<strong>{title}</strong>
			<small>{detail} · {formatMessageTime(row.createdAt)}</small>
			{#if event.summary}
				<button
					type="button"
					data-ui="thread-event-toggle"
					aria-expanded={showSummary}
					onclick={() => (showSummary = !showSummary)}
				>
					{showSummary ? 'Hide summary' : 'Show summary'}
				</button>
				{#if showSummary}
					<div data-ui="thread-event-summary">
						<MarkdownContent content={event.summary} />
					</div>
				{/if}
			{/if}
		</span>
	</div>
{/if}
