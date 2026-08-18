<script lang="ts">
	import { Minus, Square, X } from '@lucide/svelte';
	import {
		closeWindow,
		isDesktop,
		minimizeWindow,
		toggleMaximizeWindow,
	} from '../../desktop';

	// Absent in a browser, where the tab already has its own controls.
	const desktop = isDesktop();
</script>

{#if desktop}
	<div data-ui="window-controls">
		<button
			type="button"
			data-ui="window-control"
			aria-label="Minimise window"
			onclick={() => void minimizeWindow()}><Minus size={14} /></button
		>
		<button
			type="button"
			data-ui="window-control"
			aria-label="Maximise window"
			onclick={() => void toggleMaximizeWindow()}><Square size={11} /></button
		>
		<button
			type="button"
			data-ui="window-control"
			data-tone="close"
			aria-label="Close window"
			onclick={() => void closeWindow()}><X size={14} /></button
		>
	</div>
{/if}
