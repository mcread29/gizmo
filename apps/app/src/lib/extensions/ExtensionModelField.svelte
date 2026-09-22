<script lang="ts">
	import type { AgentModelOption } from '@gizmo/protocol';
	import { readModelSetting, type ModelSetting } from '@gizmo/extension-api';
	import { SelectField, type SelectOption } from '../components';

	let {
		label,
		description,
		thinking = false,
		value,
		models,
		thinkingLevels,
		onChange,
	}: {
		label: string;
		description?: string;
		thinking?: boolean;
		value: unknown;
		models: AgentModelOption[];
		thinkingLevels: string[];
		onChange: (value: ModelSetting | null) => void;
	} = $props();

	let current = $derived(readModelSetting(value));
	// Providers and ids never contain a space, so this round-trips unescaped.
	let modelValue = $derived(
		current ? `${current.provider} ${current.id}` : undefined,
	);
	let modelOptions = $derived(
		models.map((model): SelectOption => ({
			value: `${model.provider} ${model.id}`,
			label: model.name,
			hint: model.provider,
		})),
	);
	let thinkingOptions = $derived(
		thinkingLevels.map((level) => ({ value: level, label: levelLabel(level) })),
	);

	function selectModel(next: string) {
		const model = models.find(
			(candidate) => `${candidate.provider} ${candidate.id}` === next,
		);
		if (!model) return;
		onChange({
			provider: model.provider,
			id: model.id,
			...(thinking && current?.thinkingLevel
				? { thinkingLevel: current.thinkingLevel }
				: {}),
		});
	}

	function levelLabel(level: string): string {
		return level === 'xhigh'
			? 'Extra high'
			: level.charAt(0).toUpperCase() + level.slice(1);
	}
</script>

<div data-ui="extension-settings-field">
	<span>{label}</span>
	{#if description}<small>{description}</small>{/if}
	<div data-ui="extension-settings-model">
		<SelectField
			{label}
			value={modelValue}
			options={modelOptions}
			placeholder="Same as the host"
			disabled={modelOptions.length === 0}
			compact
			onValueChange={selectModel}
		/>
		{#if thinking && current}
			<div
				data-ui="segmented"
				role="radiogroup"
				aria-label="Thinking level"
				title="Thinking level"
			>
				{#each thinkingOptions as option (option.value)}
					<button
						type="button"
						data-ui="segmented-option"
						data-state={current.thinkingLevel === option.value
							? 'active'
							: 'inactive'}
						role="radio"
						aria-checked={current.thinkingLevel === option.value}
						onclick={() =>
							onChange({
								provider: current!.provider,
								id: current!.id,
								thinkingLevel: option.value,
							})}>{option.label}</button
					>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	div[data-ui='extension-settings-field'] {
		display: grid;
		gap: var(--space-1);
	}
	div[data-ui='extension-settings-model'] {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	/* Unset thinking reads as the provider's default, so no option lights. */
	div[data-ui='segmented'] {
		align-self: stretch;
	}
	small {
		color: var(--color-text-muted);
	}
</style>
