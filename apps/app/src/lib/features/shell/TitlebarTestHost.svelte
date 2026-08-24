<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import Titlebar from './Titlebar.svelte';
	import type { ComponentProps } from 'svelte';

	let props: ComponentProps<typeof Titlebar> = $props();
</script>

<Tooltip.Provider delayDuration={350} skipDelayDuration={300}>
	<Titlebar {...props} />
</Tooltip.Provider>
