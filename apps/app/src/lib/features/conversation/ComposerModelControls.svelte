<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import { SelectField, type SelectOption } from '../../components';

	let { store }: { store: AgentStore } = $props();

	let modelOptions = $derived.by(() => {
		const options: SelectOption[] = store.availableModels.map((model) => ({
			value: modelKey(model.provider, model.id),
			label: `${model.name} · ${model.provider}`,
		}));
		if (
			store.model &&
			!store.availableModels.some(
				(model) =>
					model.provider === store.model?.provider &&
					model.id === store.model?.id,
			)
		) {
			options.unshift({
				value: modelKey(store.model.provider, store.model.id),
				label: `${store.model.id} · ${store.model.provider}`,
			});
		}
		return options;
	});
	let modelValue = $derived(
		store.model ? modelKey(store.model.provider, store.model.id) : undefined,
	);
	let thinkingOptions = $derived(
		store.thinkingLevels.map((level) => ({
			value: level,
			label: thinkingLabel(level),
		})),
	);
	let controlsDisabled = $derived(
		store.modelLoading ||
			store.sessionState === 'streaming' ||
			!store.sessionId,
	);

	function selectModel(value: string) {
		const model = store.availableModels.find(
			(candidate) => modelKey(candidate.provider, candidate.id) === value,
		);
		if (model) void store.selectModel(model.provider, model.id);
	}

	function modelKey(provider: string, id: string): string {
		return JSON.stringify([provider, id]);
	}

	function thinkingLabel(level: string): string {
		return level === 'xhigh'
			? 'Extra high'
			: level.charAt(0).toUpperCase() + level.slice(1);
	}
</script>

<div data-ui="composer-model-controls">
	<SelectField
		value={modelValue}
		options={modelOptions}
		label="Model"
		placeholder="Pi default model"
		disabled={controlsDisabled || modelOptions.length === 0}
		compact
		onValueChange={selectModel}
	/>
	{#if store.model && thinkingOptions.length > 0}
		<SelectField
			value={store.model.thinkingLevel}
			options={thinkingOptions}
			label="Thinking level"
			disabled={controlsDisabled}
			compact
			onValueChange={(level) => void store.selectThinkingLevel(level)}
		/>
	{/if}
</div>
