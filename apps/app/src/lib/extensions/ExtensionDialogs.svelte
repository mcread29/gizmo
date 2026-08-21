<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	import { extensions } from './registry';
	let { store, layout }: { store: AgentStore; layout: WorkspaceLayout } =
		$props();
</script>

{#each extensions.filter(({ id, dialog }) => dialog && (store.activeDomains.includes(id) || store.pendingConfirmations.length > 0)) as definition (definition.id)}
	{@const Dialog = definition.dialog!}
	<Dialog {store} {layout} />
{/each}
