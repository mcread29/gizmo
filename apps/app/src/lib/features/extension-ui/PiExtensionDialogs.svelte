<script lang="ts">
	import PiExtensionDialog from './PiExtensionDialog.svelte';
	import type { PiExtensionUiStore } from './PiExtensionUiStore.svelte';

	let {
		ui,
		sessionId,
	}: {
		ui: PiExtensionUiStore;
		sessionId?: string;
	} = $props();
	let dialog = $derived(ui.dialogFor(sessionId));
</script>

{#if dialog}
	{#key dialog.uiRequestId}
		<PiExtensionDialog {ui} {dialog} />
	{/key}
{/if}
