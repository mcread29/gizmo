<script lang="ts">
	import { fakeConsoleEntries } from '../fixtures';
</script>

<!--
	Dev-only stand-in for the Unity extension's console tab: enough rows, tones
	and source locations to judge the inspector's density without a running
	editor behind it.
-->
<div data-ui="fake-console">
	{#each fakeConsoleEntries as entry, index (index)}
		<div data-ui="fake-console-entry" data-level={entry.level}>
			<strong>{entry.level}</strong>
			<span>{entry.message}</span>
			{#if entry.file}
				<small>{entry.file}:{entry.line}</small>
			{/if}
		</div>
	{/each}
</div>

<style>
	[data-ui='fake-console'] {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	[data-ui='fake-console-entry'] {
		display: grid;
		gap: 2px;
		padding: var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface-soft);
		font-size: var(--text-xs);
	}

	strong {
		color: var(--color-text-muted);
		font-size: var(--text-2xs);
		text-transform: uppercase;
	}

	[data-level='warn'] strong {
		color: var(--color-warning);
	}

	[data-level='error'] strong {
		color: var(--color-danger);
	}

	small {
		color: var(--color-text-faint);
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
	}
</style>
