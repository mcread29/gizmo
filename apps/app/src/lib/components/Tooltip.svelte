<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		text,
		children,
	}: { text: string; children: Snippet<[HTMLButtonAttributes]> } = $props();
</script>

<Tooltip.Provider delayDuration={350}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}{@render children(props)}{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content data-ui="tooltip" sideOffset={6}>{text}</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>
