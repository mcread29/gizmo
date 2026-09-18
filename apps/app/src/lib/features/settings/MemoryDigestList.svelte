<script lang="ts">
	import type { JournalDigest } from '@gizmo/protocol';

	let { digests, query }: { digests: JournalDigest[]; query: string } =
		$props();
</script>

{#each digests as digest (digest.segment)}
	<article data-ui="memory-digest">
		<header>
			<code>{digest.segment}</code>
			<em data-outcome={digest.outcome}>{digest.outcome}</em>
		</header>
		<p>{digest.summary}</p>
		{#if digest.decisions.length > 0}
			<strong>Decisions</strong>
			<ul>
				{#each digest.decisions as decision (decision)}
					<li>{decision}</li>
				{/each}
			</ul>
		{/if}
		{#if digest.errors.length > 0}
			<strong>Errors</strong>
			<ul>
				{#each digest.errors as issue (issue)}
					<li>{issue}</li>
				{/each}
			</ul>
		{/if}
		{#if digest.files.length > 0}
			<div data-ui="memory-digest-files">
				{#each digest.files as file (file)}
					<code>{file}</code>
				{/each}
			</div>
		{/if}
	</article>
{:else}
	<p data-ui="settings-empty">
		{query
			? 'No memories match that filter.'
			: 'No memories yet. Choose a model and digest this workspace.'}
	</p>
{/each}
