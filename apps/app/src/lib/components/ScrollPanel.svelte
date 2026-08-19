<script lang="ts">
	import { ScrollArea } from 'bits-ui';
	import type { Snippet } from 'svelte';

	/*
	 * `name` rather than a caller-supplied data-ui: the root has to keep
	 * data-ui="scroll-area" for the primitive's own styling, so per-use styling
	 * hangs off a second attribute instead of silently overwriting it.
	 */
	let {
		children,
		name,
		viewport = $bindable(null),
		...rest
	}: ScrollArea.RootProps & {
		children: Snippet;
		name?: string;
		viewport?: HTMLElement | null;
	} = $props();
</script>

<ScrollArea.Root {...rest} data-ui="scroll-area" data-scroll={name}>
	<ScrollArea.Viewport bind:ref={viewport} data-ui="scroll-viewport"
		>{@render children()}</ScrollArea.Viewport
	>
	<ScrollArea.Scrollbar data-ui="scrollbar" orientation="vertical">
		<ScrollArea.Thumb data-ui="scroll-thumb" />
	</ScrollArea.Scrollbar>
</ScrollArea.Root>
