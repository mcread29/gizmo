<script lang="ts">
	import type { InspectorTabContribution } from '../extensions/types';

	let {
		extensionTabs,
	}: {
		extensionTabs: InspectorTabContribution[];
		activePanel: string;
		onSelectPanel: (panel: string) => void;
	} = $props();
</script>

<div data-ui="test-domain-panel">
	{#each extensionTabs as tab (tab.id)}
		<span data-ui="test-domain-panel-tab">{tab.label}</span>
	{/each}
</div>
