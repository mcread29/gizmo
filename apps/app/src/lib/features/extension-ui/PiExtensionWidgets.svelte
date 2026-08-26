<script lang="ts">
	import type { PiExtensionUiStore } from './PiExtensionUiStore.svelte';

	let {
		ui,
		sessionId,
		placement,
	}: {
		ui: PiExtensionUiStore;
		sessionId?: string;
		placement: 'aboveEditor' | 'belowEditor';
	} = $props();
	let widgets = $derived(ui.widgetsFor(sessionId, placement));
</script>

{#if widgets.length > 0}
	<div data-ui="extension-widgets" data-placement={placement}>
		{#each widgets as widget (`${widget.runtimeId}:${widget.request.key}`)}
			<div data-ui="extension-widget">
				{widget.request.lines?.join('\n') ?? ''}
			</div>
		{/each}
	</div>
{/if}
