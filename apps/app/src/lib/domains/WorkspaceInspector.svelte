<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import { webDomain } from './registry';
	import SvelteInspector from './SvelteInspector.svelte';
	import type { ActiveWorkspaceView } from './workspace-view';

	let {
		store,
		view,
		hidden,
	}: { store: AgentStore; view: ActiveWorkspaceView; hidden: boolean } =
		$props();
	let definition = $derived(webDomain(view.domainId));
</script>

{#if definition}
	{@const Inspector = definition.inspector}
	<Inspector {store} {view} {hidden} />
{:else}
	<SvelteInspector {store} {view} {hidden} />
{/if}
