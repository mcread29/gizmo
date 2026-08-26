<script lang="ts">
	import { onDestroy } from 'svelte';
	import { formatElapsed, type StreamingActivity } from './streaming';

	interface Props {
		activity: StreamingActivity;
		/** Compact form drops the pulsing caret, for the titlebar. */
		compact?: boolean;
	}

	let { activity, compact = false }: Props = $props();
	let now = $state(Date.now());

	// A long Unity compile behind a static label reads as a hang; count it out.
	const timer = setInterval(() => (now = Date.now()), 1_000);
	onDestroy(() => clearInterval(timer));

	let elapsed = $derived(
		activity.startedAt ? formatElapsed(now - activity.startedAt) : undefined,
	);
</script>

<p data-ui="streaming-indicator" data-compact={compact} role="status">
	{#if !compact}
		{#if activity.indicator}
			<span data-ui="streaming-custom-indicator" aria-hidden="true"
				>{activity.indicator}</span
			>
		{:else}
			<span data-ui="streaming-cursor" aria-hidden="true"></span>
		{/if}
	{/if}
	<span>{activity.label}…</span>
	{#if elapsed}<span data-ui="streaming-elapsed">{elapsed}</span>{/if}
</p>
