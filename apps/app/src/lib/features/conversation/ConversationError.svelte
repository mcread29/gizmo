<script lang="ts">
	import { CircleX, PlugZap, X } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';

	let { store }: { store: AgentStore } = $props();

	let reconnect = $derived(
		store.error?.kind === 'connection' && store.connection === 'disconnected',
	);
</script>

<!--
	Anchored above the transcript rather than inside it: an error that scrolls
	away with the messages is an error the user cannot act on.
-->
{#if store.error}
	<div data-ui="error-banner" role="alert">
		<CircleX size={17} />
		<span>{store.error.message}</span>
		{#if reconnect}
			<Button
				variant="ghost"
				size="sm"
				onclick={() => void store.reconnectNow()}
				><PlugZap size={13} /> Reconnect</Button
			>
		{/if}
		<Button
			variant="ghost"
			size="icon"
			aria-label="Dismiss error"
			onclick={() => (store.error = undefined)}><X size={15} /></Button
		>
	</div>
{/if}
