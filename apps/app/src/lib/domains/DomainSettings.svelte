<script lang="ts">
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	import { webDomains } from './registry';
	let {
		layout,
		activeDomains,
	}: { layout: WorkspaceLayout; activeDomains: string[] } = $props();
</script>

{#each webDomains.filter(({ id, settings }) => settings && activeDomains.includes(id)) as definition (definition.id)}
	{@const Settings = definition.settings!}
	<Settings {layout} />
{/each}
