<script lang="ts">
	import { BrandMark } from '../../components';

	let { loading, empty }: { loading: boolean; empty: boolean } = $props();
	const skeletonRows = ['first', 'second', 'third'];
</script>

{#if loading && empty}
	<div data-ui="message-skeleton" aria-label="Loading transcript">
		{#each skeletonRows as row (row)}
			<div data-ui="skeleton" data-shape="avatar"></div>
			<div>
				<div data-ui="skeleton" data-shape="line"></div>
				<div data-ui="skeleton" data-shape="line" data-width="short"></div>
			</div>
		{/each}
	</div>
{:else if empty}
	<div data-ui="conversation-empty">
		<div data-ui="brand-mark"><BrandMark size={38} /></div>
		<h2>Ready when you are</h2>
		<p>
			Ask about the open project, inspect the Editor, or run a registered
			command.
		</p>
	</div>
{/if}
