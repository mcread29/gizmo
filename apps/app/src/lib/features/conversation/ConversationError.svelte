<script lang="ts">
	import { CircleX, RotateCw, X } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';

	let { store }: { store: AgentStore } = $props();
</script>

<!--
	Anchored above the transcript rather than inside it: an error that scrolls
	away with the messages is an error the user cannot act on.
-->
{#if store.error}
	<div data-ui="error-banner" role="alert">
		<CircleX size={17} />
		<span>{store.error}</span>
		{#if store.lastPrompt && store.sessionState !== 'streaming'}
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
