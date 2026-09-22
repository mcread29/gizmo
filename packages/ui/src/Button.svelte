<script lang="ts">
	import { Button } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		children,
		variant = 'secondary',
		size = 'md',
		hook,
		...rest
	}: Button.RootProps & {
		children?: Snippet;
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'icon';
		/**
		 * A call site's own styling hook, rendered as `data-part`. `data-ui` is
		 * always "button" — it is what every button rule matches — so a
		 * `data-ui` passed in is overwritten and never reaches the DOM.
		 */
		hook?: string;
	} = $props();
</script>

<Button.Root
	{...rest}
	data-ui="button"
	data-part={hook}
	data-variant={variant}
	data-size={size}
>
	{@render children?.()}
</Button.Root>
