<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import { webDomain } from './registry';
	import SvelteInspector from './SvelteInspector.svelte';
	import type { ActiveWorkspaceView } from './workspace-view';

	let {
		store,
		view,
		hidden,
		onCollapse,
	}: {
		store: AgentStore;
		view: ActiveWorkspaceView;
		hidden: boolean;
		/** Absent while the inspector is collapsed: its rail owns the control. */
		onCollapse?: () => void;
	} = $props();
	let definition = $derived(webDomain(view.domainId));
</script>

{#if definition}
	{@const Inspector = definition.inspector}
	<Inspector {store} {view} {hidden} {onCollapse} />
{:else}
	<SvelteInspector {store} {view} {hidden} {onCollapse} />
{/if}
