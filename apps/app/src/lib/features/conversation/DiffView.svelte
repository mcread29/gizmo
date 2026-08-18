<script lang="ts">
	import { diffStat, parseDiff } from './diff';

	let { diff }: { diff: string } = $props();

	let lines = $derived(parseDiff(diff));
	let stat = $derived(diffStat(lines));
</script>

<div data-ui="diff">
	<div data-ui="diff-summary">
		<span data-kind="added">+{stat.added}</span>
		<span data-kind="removed">−{stat.removed}</span>
	</div>
	<div data-ui="diff-body" role="table" aria-label="File changes">
		{#each lines as line, index (index)}
			<div data-ui="diff-line" data-kind={line.kind} role="row">
				<span data-ui="diff-gutter" aria-hidden="true"
					>{line.oldLine ?? ''}</span
				>
				<span data-ui="diff-gutter" aria-hidden="true"
					>{line.newLine ?? ''}</span
				>
				<span data-ui="diff-text" role="cell">{line.text || ' '}</span>
			</div>
		{/each}
	</div>
</div>
