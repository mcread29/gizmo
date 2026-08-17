<script lang="ts">
	import { ScrollArea } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let { children, ...rest }: ScrollArea.RootProps & { children: Snippet } =
		$props();
</script>

<ScrollArea.Root {...rest} data-ui="scroll-area">
	<ScrollArea.Viewport data-ui="scroll-viewport"
		>{@render children()}</ScrollArea.Viewport
	>
	<ScrollArea.Scrollbar data-ui="scrollbar" orientation="vertical">
		<ScrollArea.Thumb data-ui="scroll-thumb" />
	</ScrollArea.Scrollbar>
</ScrollArea.Root>
