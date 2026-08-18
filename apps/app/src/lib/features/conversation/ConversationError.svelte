<script lang="ts">
	import { CircleX, PlugZap, RotateCw, X } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';

	let { store }: { store: AgentStore } = $props();

	/*
	 * The offered action follows the kind of failure. Retrying a prompt that the
	 * agent rejected is useful; "retrying" a rename that the server refused is
	 * not, and offering it anyway teaches people to ignore the banner.
	 */
	let retryPrompt = $derived(
		store.error?.kind === 'prompt' ||
			(store.error?.kind === 'agent' && Boolean(store.lastPrompt)),
	);
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
				onclick={() => void store.retryConnection()}
				><PlugZap size={13} /> Reconnect</Button
			>
		{:else if retryPrompt && store.lastPrompt && store.sessionState !== 'streaming'}
			<Button variant="ghost" size="sm" onclick={() => void store.retryPrompt()}
				><RotateCw size={13} /> Retry</Button
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
