<script lang="ts">
	const topics = [
		{
			id: 'runes',
			title: '$state and $derived',
			blurb: 'Reactivity primitives.',
		},
		{ id: 'snippets', title: 'Snippets', blurb: 'Reusable markup fragments.' },
		{ id: 'actions', title: 'Actions', blurb: 'use: directives on elements.' },
		{ id: 'stores', title: 'Stores', blurb: 'The pre-runes subscription API.' },
	];

	let query = $state('');
	let matches = $derived(
		topics.filter(({ title }) =>
			title.toLowerCase().includes(query.trim().toLowerCase()),
		),
	);
</script>

<!--
	Dev-only stand-in for a docs-style inspector tab. Its only job is to put a
	filter field and a result list in the panel, so inspector layouts that hold
	an input can be judged at the rail's real width.
-->
<div data-ui="fake-docs">
	<input placeholder="Filter topics" bind:value={query} />
	{#each matches as topic (topic.id)}
		<div data-ui="fake-doc">
			<strong>{topic.title}</strong>
			<span>{topic.blurb}</span>
		</div>
	{:else}
		<p>No topics match.</p>
	{/each}
</div>

<style>
	[data-ui='fake-docs'] {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	input {
		padding: 6px var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface-soft);
		color: var(--color-text);
		font: inherit;
		font-size: var(--text-xs);
	}

	[data-ui='fake-doc'] {
		display: grid;
		gap: 1px;
		font-size: var(--text-xs);
	}

	span,
	p {
		margin: 0;
		color: var(--color-text-muted);
		font-size: var(--text-2xs);
	}
</style>
