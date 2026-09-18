<script lang="ts">
	import type { AgentStore } from '../../AgentStore.svelte';

	let { store }: { store: AgentStore } = $props();
	let files = $derived(store.gitStatus?.files ?? []);
</script>

<!--
	Dev-only stand-in for the Git extension's inspector tab. It reads the same
	store the real tab does, so toggling the extension off in Configure empties
	this exactly as it would against a live agent.
-->
<div data-ui="fake-changes">
	<p>{store.gitStatus?.branch ?? 'No repository'}</p>
	{#each files as file (file.path)}
		<div data-ui="fake-change">
			<strong>{file.workingTree.trim() || file.index.trim()}</strong>
			<span>{file.path}</span>
		</div>
	{:else}
		<p>Nothing changed.</p>
	{/each}
</div>

<style>
	[data-ui='fake-changes'] {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	p {
		margin: 0;
		color: var(--color-text-muted);
		font-size: var(--text-xs);
	}

	[data-ui='fake-change'] {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		min-width: 0;
		font-size: var(--text-xs);
	}

	strong {
		flex: none;
		width: 1.2em;
		color: var(--color-accent);
		font-family: var(--font-mono);
	}

	span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
