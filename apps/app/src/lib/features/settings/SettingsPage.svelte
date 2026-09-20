<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/**
		 * What a change here reaches, when the nav group has not already said
		 * it. Most pages leave this off; the ones that keep it have something
		 * their group cannot express, like Context's "new and resumed threads".
		 * Under `hideHeader` it is the toolbar's only text, so those pages set it.
		 */
		scope?: string;
		children: Snippet;
		actions?: Snippet;
		hideHeader?: boolean;
	}

	let { title, scope, children, actions, hideHeader = false }: Props = $props();
</script>

<section data-ui="settings-page" aria-label={title}>
	{#if hideHeader}
		<div data-ui="settings-page-toolbar">
			<span>{scope ?? ''}</span>
			{#if actions}<div data-ui="settings-page-actions">
					{@render actions()}
				</div>{/if}
		</div>
	{:else}
		<header data-ui="settings-page-header">
			<div>
				<h2>{title}</h2>
				{#if scope}<span>{scope}</span>{/if}
			</div>
			{#if actions}<div data-ui="settings-page-actions">
					{@render actions()}
				</div>{/if}
		</header>
	{/if}
	<div data-ui="settings-page-body">
		{@render children()}
	</div>
</section>
