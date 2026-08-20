<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	import { webDomains } from './registry';
	let { store, layout }: { store: AgentStore; layout: WorkspaceLayout } =
		$props();
</script>

{#each webDomains.filter(({ id, dialog }) => dialog && (store.activeDomains.includes(id) || (id === 'unity' && store.pendingConfirmations.length > 0))) as definition (definition.id)}
	{@const Dialog = definition.dialog!}
	<Dialog {store} {layout} />
{/each}
