<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/**
		 * Who the page's settings apply to. Stated on every page because the
		 * screen mixes device preferences with machine-wide agent configuration.
		 */
		scope: string;
		children: Snippet;
		actions?: Snippet;
	}

	let { title, scope, children, actions }: Props = $props();
</script>

<section data-ui="settings-page" aria-label={title}>
	<header data-ui="settings-page-header">
		<div>
			<h2>{title}</h2>
			<span>{scope}</span>
		</div>
		{#if actions}<div data-ui="settings-page-actions">
				{@render actions()}
			</div>{/if}
	</header>
	<div data-ui="settings-page-body">
		{@render children()}
	</div>
</section>
