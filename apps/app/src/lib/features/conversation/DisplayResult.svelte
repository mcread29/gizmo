<script lang="ts">
	import type { DisplayEnvelope } from '@gizmo/protocol';
	import {
		JsonUIProvider,
		Renderer,
		type ComponentRegistry,
	} from '@json-render/svelte';
	import DisplayElement from './DisplayElement.svelte';
	import { displayCatalog } from './display-catalog';

	let { display }: { display: DisplayEnvelope } = $props();
	let spec = $derived({
		root: display.spec.root,
		elements: Object.fromEntries(
			Object.entries(display.spec.elements).map(([key, node]) => [
				key,
				{ ...node, props: { ...node.props } },
			]),
		),
	});
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
	{#if display.title}<h3>{display.title}</h3>{/if}
	<JsonUIProvider><Renderer {spec} {registry} /></JsonUIProvider>
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
