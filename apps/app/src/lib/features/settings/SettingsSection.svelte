<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		children,
	}: { title: string; description: string; children: Snippet } = $props();
</script>

<section data-ui="settings-section">
	<div data-ui="settings-section-header">
		<strong>{title}</strong>
		<span>{description}</span>
	</div>
	{@render children()}
</section>
