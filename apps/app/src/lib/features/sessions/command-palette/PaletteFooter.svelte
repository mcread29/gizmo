<script lang="ts">
	import type { CommandPaletteMode } from './types';

	interface Props {
		mode: CommandPaletteMode;
		location?: string;
	}

	let { mode, location = '' }: Props = $props();
</script>

<div data-ui="palette-footer">
	<span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
	{#if mode === 'workspace'}
		<span><kbd>Tab</kbd> Complete path</span>
		<span><kbd>Alt</kbd>+<kbd>P</kbd> Pin</span>
		{#if !location}<span><kbd>Backspace</kbd> Back</span>{/if}
	{/if}
	<span><kbd>Esc</kbd> Close</span>
	<span data-ui="palette-footer-primary">
		<kbd>Enter</kbd>
		{mode === 'root' ? 'Select' : 'Add'}
	</span>
</div>
