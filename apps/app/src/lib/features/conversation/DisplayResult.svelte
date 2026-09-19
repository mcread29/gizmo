<script lang="ts">
	import type { DisplayEnvelope } from '@gizmo/protocol';
	import {
		JsonUIProvider,
		Renderer,
		type ComponentRegistry,
	} from '@json-render/svelte';
	import DisplayElement from './DisplayElement.svelte';
	import { displayCatalog } from './display-catalog';
	import ViewRenderer from '../../extensions/view/ViewRenderer.svelte';
	import { appIntentHost } from '../../extensions/view/intents';

	let {
		display,
		projectPath,
	}: { display: DisplayEnvelope; projectPath?: string } = $props();
	let spec = $derived.by(() => {
		if ('view' in display) return undefined;
		return {
			root: display.spec.root,
			elements: Object.fromEntries(
				Object.entries(display.spec.elements).map(([key, node]) => [
					key,
					{ ...node, props: { ...node.props } },
				]),
			),
		};
	});
	// A card has no open view on the server, so only the host's own intents
	// can run; switching threads from a transcript card is not one of them.
	let host = $derived(appIntentHost(projectPath, () => {}));
	const registry = {
		Heading: DisplayElement,
		Text: DisplayElement,
		Card: DisplayElement,
		Stack: DisplayElement,
		List: DisplayElement,
		Table: DisplayElement,
		Metric: DisplayElement,
		Divider: DisplayElement,
	} satisfies ComponentRegistry &
		Record<keyof typeof displayCatalog.data.components, typeof DisplayElement>;
</script>

<div data-ui="display-result">
	{#if 'view' in display}
		<ViewRenderer view={display.view} {projectPath} {host} readonly />
	{:else}
		{#if display.title}<h3>{display.title}</h3>{/if}
		{#if spec}
			<JsonUIProvider><Renderer {spec} {registry} /></JsonUIProvider>
		{/if}
	{/if}
</div>

<style>
	div {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		font-size: var(--text-sm);
		line-height: 1.5;
	}
	h3 {
		margin: 0;
		font-size: var(--text-base);
		font-weight: 600;
	}
</style>
