<script lang="ts">
	import type { Block } from '@gizmo/extension-api';

	type LogBlock = Extract<Block, { type: 'log' }>;

	let { block }: { block: LogBlock } = $props();
	let viewport = $state<HTMLElement>();

	// `follow` means the newest line is the interesting one; re-run on every
	// line change so a streaming log stays pinned to the bottom.
	$effect(() => {
		block.lines.length;
		if (!block.follow || !viewport) return;
		viewport.scrollTop = viewport.scrollHeight;
	});

	function time(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString();
	}
</script>

<div data-ui="view-log" bind:this={viewport}>
	{#if block.truncated}
		<p data-ui="view-log-truncated">Earlier lines were dropped.</p>
	{/if}
	{#each block.lines as line, index (index)}
		<p data-ui="view-log-line" data-tone={line.tone}>
			{#if line.timestamp !== undefined}<time>{time(line.timestamp)}</time>{/if}
			<span>{line.text}</span>
		</p>
	{/each}
</div>
