<script lang="ts">
	import type { DisplayEnvelope } from '@gizmo/protocol';
	import {
		JsonUIProvider,
		Renderer,
		type ComponentRegistry,
	} from '@json-render/svelte';
	import { extension } from '../../extensions/registry.svelte';
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
	const builtin = {
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

	// A catalog names the extension and registry that render this spec. The
	// web extension registry is reactive, so a bundle that arrives (or is
	// reloaded) after the card mounted still renders it.
	let catalog = $derived('catalog' in display ? display.catalog : undefined);
	let registry = $derived.by((): ComponentRegistry | undefined => {
		if (!catalog) return builtin;
		const slash = catalog.indexOf('/');
		const found = extension(catalog.slice(0, slash))?.displayCatalogs?.[
			catalog.slice(slash + 1)
		];
		if (!found) return undefined;
		// Every element type must be known to the registry; json-render would
		// otherwise render nothing for it silently.
		const types = new Set(
			Object.values(display.spec.elements).map(({ type }) => type),
		);
		return [...types].every((type) => type in found) ? found : undefined;
	});
</script>

<div data-ui="display-result">
	{#if display.title}<h3>{display.title}</h3>{/if}
	{#if registry}
		<JsonUIProvider><Renderer {spec} {registry} /></JsonUIProvider>
	{:else}
		<p class="missing">
			This card needs the "{catalog}" display catalog, which no installed
			extension provides.
		</p>
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
	.missing {
		margin: 0;
		color: var(--color-text-muted);
	}
</style>
