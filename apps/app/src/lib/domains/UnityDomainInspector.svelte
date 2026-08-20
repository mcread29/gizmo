<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import UnityInspector from '../features/unity/UnityInspector.svelte';
	import type { ActiveWorkspaceView } from './workspace-view';

	let {
		store,
		view,
		hidden,
	}: { store: AgentStore; view: ActiveWorkspaceView; hidden: boolean } =
		$props();
</script>

{#if view.unity}
	<UnityInspector
		{store}
		view={view.unity}
		{hidden}
		onOpenProject={() => store.openSelectedProject()}
	/>
{/if}
