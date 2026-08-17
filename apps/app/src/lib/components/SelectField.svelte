<script lang="ts">
	import { Check, ChevronDown } from '@lucide/svelte';
	import { Select } from 'bits-ui';

	export interface SelectOption {
		value: string;
		label: string;
	}

	let {
		value = $bindable(),
		options,
		label,
		placeholder = 'Select an option',
		disabled = false,
		compact = false,
		onValueChange,
	}: {
		value?: string;
		options: SelectOption[];
		label: string;
		placeholder?: string;
		disabled?: boolean;
		compact?: boolean;
		onValueChange?: (value: string) => void;
	} = $props();

	let selectedLabel = $derived(
		options.find((option) => option.value === value)?.label,
	);
</script>

<Select.Root type="single" bind:value {disabled} {onValueChange}>
	<Select.Trigger
		data-ui="select-trigger"
		data-size={compact ? 'compact' : undefined}
		aria-label={label}
	>
		<span>{selectedLabel ?? placeholder}</span>
		<ChevronDown size={14} />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content data-ui="select-content" sideOffset={5}>
			<Select.Viewport>
				{#each options as option}
					<Select.Item
						data-ui="select-item"
						value={option.value}
						label={option.label}
					>
						{#snippet children({ selected })}
							<span>{option.label}</span>
							{#if selected}<Check data-ui="select-indicator" size={14} />{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
