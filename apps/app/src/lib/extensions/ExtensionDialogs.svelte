<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	import { webExtensions } from './registry.svelte';
	let { store, layout }: { store: AgentStore; layout: WorkspaceLayout } =
		$props();
</script>

{#each webExtensions().filter(({ id, dialog }) => dialog && (store.enabledExtensionIds.includes(id) || store.pendingConfirmations.length > 0)) as definition (definition.id)}
	{@const Dialog = definition.dialog!}
	<Dialog {store} settings={layout.settingsFor(definition.id)} />
{/each}
