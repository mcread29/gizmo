<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		/**
		 * Left off when the label already says it. A row without one collapses
		 * to a single line, which is where the density of a settings page comes
		 * from — the alternative is a sentence written to fill the slot.
		 */
		description?: string;
		/**
		 * A description that has to be computed, like a progress line that
		 * changes while a job runs. Use `description` for anything static.
		 */
		detail?: Snippet;
		/** Put the control under the label, for sliders and full-width inputs. */
		stacked?: boolean;
		disabled?: boolean;
		children: Snippet;
	}

	let {
		label,
		description,
		detail,
		stacked = false,
		disabled = false,
		children,
	}: Props = $props();
</script>

<div
	data-ui="setting-field"
	data-layout={stacked ? 'stacked' : undefined}
	data-state={disabled ? 'disabled' : undefined}
	data-density={description || detail ? undefined : 'compact'}
>
	<div>
		<strong>{label}</strong>
		{#if description}<span>{description}</span>{/if}
		{#if detail}<span>{@render detail()}</span>{/if}
	</div>
	{@render children()}
</div>
