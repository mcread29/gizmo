<script lang="ts">
	import { RotateCw } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';

	let { store }: { store: AgentStore } = $props();

	const labels = {
		connected: 'Local agent ready',
		connecting: 'Connecting to agent',
		reconnecting: 'Reconnecting to agent',
		disconnected: 'Local agent offline',
	} as const;
</script>

<div data-ui="connection-row" data-status={store.connection}>
	<span data-ui="status-dot" data-status={store.connection}></span>
	<span>{labels[store.connection]}</span>
	{#if store.connection === 'disconnected'}
		<!-- Reconnection is automatic and backs off; this is the escape hatch for
		     someone who just restarted the server and does not want to wait. -->
		<Button
			variant="ghost"
			size="sm"
			onclick={() => void store.retryConnection()}
			><RotateCw size={13} /> Retry</Button
		>
	{/if}
</div>
