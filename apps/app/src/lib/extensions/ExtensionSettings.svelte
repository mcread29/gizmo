<script lang="ts">
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	import { webExtensions } from './registry.svelte';
	let {
		layout,
		enabledExtensionIds,
	}: { layout: WorkspaceLayout; enabledExtensionIds: string[] } = $props();
</script>

{#each webExtensions().filter(({ id, settings }) => settings && enabledExtensionIds.includes(id)) as definition (definition.id)}
	{@const Settings = definition.settings!}
	<Settings settings={layout.settingsFor(definition.id)} />
{/each}
