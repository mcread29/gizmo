<script lang="ts">
	import { Check, ChevronDown } from '@lucide/svelte';
	import { Select } from 'bits-ui';

	export interface SelectOption {
		value: string;
		label: string;
		/** Secondary text; truncated before the label when space runs out. */
		hint?: string;
	}

	let {
		value = $bindable(),
		options,
		label,
		placeholder = 'Select an option',
		disabled = false,
		compact = false,
		title,
		onValueChange,
	}: {
		value?: string;
		options: SelectOption[];
		label: string;
		placeholder?: string;
		disabled?: boolean;
		compact?: boolean;
		title?: string;
		onValueChange?: (value: string) => void;
	} = $props();

	let selected = $derived(options.find((option) => option.value === value));
</script>

<Select.Root type="single" bind:value {disabled} {onValueChange}>
	<Select.Trigger
		data-ui="select-trigger"
		data-size={compact ? 'compact' : undefined}
		aria-label={label}
		{title}
	>
		<span>
			<span data-ui="select-label">{selected?.label ?? placeholder}</span>
			{#if selected?.hint}<span data-ui="select-hint">{selected.hint}</span
				>{/if}
		</span>
		<ChevronDown size={14} />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content data-ui="select-content" sideOffset={5}>
			<Select.Viewport>
				{#each options as option (option.value)}
					<Select.Item
						data-ui="select-item"
						value={option.value}
						label={option.label}
					>
						{#snippet children({ selected: isSelected })}
							<span>{option.label}</span>
							{#if option.hint}<small data-ui="select-hint">{option.hint}</small
								>{/if}
							{#if isSelected}<Check
									data-ui="select-indicator"
									size={14}
								/>{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
