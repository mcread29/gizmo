<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import UnityInspector from '../features/unity/UnityInspector.svelte';
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
		onCollapse?: () => void;
	} = $props();
</script>

{#if view.unity}
	<UnityInspector
		{store}
		view={view.unity}
		{hidden}
		{onCollapse}
		onOpenProject={() => store.openSelectedProject()}
	/>
{/if}
