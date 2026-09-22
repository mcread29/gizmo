<script lang="ts">
	import { shortcutHint } from '../shell/shortcuts';

	/* Mirrors shortcutFor() in shell/shortcuts.ts; keep the two in step. */
	const shortcuts = [
		['New thread', shortcutHint('N')],
		['Command palette', shortcutHint('K')],
		['Search threads', shortcutHint('⇧K')],
		['Find in thread', shortcutHint('F')],
		['Focus the composer', shortcutHint('⇧L')],
		['Session tree', shortcutHint('⇧T')],
		['Toggle sidebar', shortcutHint('B')],
		['Toggle inspector', shortcutHint('⇧B')],
		['Settings', shortcutHint(',')],
		['Close or dismiss', 'Esc'],
	] as const;
</script>

<div data-ui="settings-card">
	<div data-ui="settings-subhead">
		<h3>Keyboard shortcuts</h3>
	</div>
	<dl data-ui="shortcut-list">
		{#each shortcuts as [label, keys] (label)}
			<div>
				<dt>{label}</dt>
				<dd><kbd>{keys}</kbd></dd>
			</div>
		{/each}
	</dl>
</div>

<style>
	dl {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0 var(--space-4) var(--space-3);
	}
	dl > div {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-3);
		font-size: var(--text-xs);
	}
	dt {
		color: var(--color-text);
	}
	dd {
		margin: 0;
	}
	kbd {
		padding: 1px 6px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface-soft);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
	}
</style>
