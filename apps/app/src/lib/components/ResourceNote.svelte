<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Errors announce themselves; an empty state only does when it replaces content. */
		tone?: 'empty' | 'error';
		/** Announce an empty state too — used for "Loading…" placeholders. */
		live?: boolean;
		children: Snippet;
	}

	let { tone = 'empty', live = false, children }: Props = $props();
</script>

<p
	data-ui={tone === 'error' ? 'resource-error' : 'resource-empty'}
	role={tone === 'error' ? 'alert' : live ? 'status' : undefined}
>
	{@render children()}
</p>
