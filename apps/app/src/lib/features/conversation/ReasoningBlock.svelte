<script lang="ts">
	import { Brain } from '@lucide/svelte';
	import MarkdownContent from './MarkdownContent.svelte';

	interface Props {
		/** Readable reasoning, when the provider exposed any. */
		reasoning?: string;
		/** The provider withheld the reasoning text. */
		redacted?: boolean;
		/** Folded state this block opens in, from Settings. */
		expanded?: boolean;
		streaming?: boolean;
	}

	let {
		reasoning,
		redacted,
		expanded = false,
		streaming = false,
	}: Props = $props();

	// Follows the setting, so changing it re-folds blocks already on screen
	// rather than only applying to the next reply.
	let open = $state(false);
	$effect(() => {
		open = expanded;
	});
</script>

{#if reasoning?.trim()}
	<details data-ui="reasoning" bind:open>
		<summary>
			<Brain size={13} />
			<span>Reasoning</span>
		</summary>
		{#if open}
			<div data-ui="reasoning-content">
				<MarkdownContent content={reasoning} {streaming} />
			</div>
		{/if}
	</details>
{:else if redacted}
	<p data-ui="reasoning-withheld">
		<Brain size={13} />
		<span>Reasoning withheld by the provider</span>
	</p>
{/if}
