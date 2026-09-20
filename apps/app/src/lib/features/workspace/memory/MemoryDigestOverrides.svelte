<script lang="ts">
	import type { DigestModelRef } from '@gizmo/protocol';
	import { Switch } from 'bits-ui';
	import { Button, SettingField } from '../../../components';
	import {
		inheritModel,
		noModel,
		type WorkspaceMemory,
	} from './workspace-memory.svelte';

	interface Props {
		memory: WorkspaceMemory;
		/** Every model this machine can reach, as the global default names them. */
		models: readonly { provider: string; id: string; name: string }[];
	}

	let { memory, models }: Props = $props();

	let status = $derived(memory.status);
	/*
	 * Each setting is inherited or overridden on its own, so the override
	 * itself is read rather than compared against the default: a workspace that
	 * pinned the same model the default happens to name is still overridden,
	 * and clearing it has to stay available.
	 */
	let modelOverridden = $derived(
		status?.override !== undefined && 'model' in status.override,
	);
	let autoOverridden = $derived(status?.override?.auto !== undefined);
	/**
	 * The current choice is marked on the options rather than set on the
	 * select: the list comes from an `{#each}` that renders after the select
	 * itself, so a value assigned to the element finds no option to match and
	 * leaves the control showing nothing.
	 */
	let selectedModel = $derived(
		!modelOverridden
			? inheritModel
			: status?.settings.model
				? `${status.settings.model.provider}/${status.settings.model.id}`
				: noModel,
	);
	let defaultLabel = $derived(modelLabel(status?.defaults.model));
	let modelHere = $derived(modelLabel(status?.settings.model));
	let auto = $derived(status?.settings.auto ?? true);

	function modelLabel(model: DigestModelRef | undefined) {
		return model ? `${model.provider} · ${model.id}` : 'off';
	}
</script>

<!--
	Set globally, overridden here — the same bargain as a skill or an extension,
	so the tab says what it inherits before it offers to change it.
-->
<div data-ui="settings-card">
	<SettingField label="Digest model" stacked>
		{#snippet detail()}
			{modelOverridden
				? `Overridden · ${modelHere}`
				: `Inherits global · ${defaultLabel}`}
		{/snippet}
		<div data-ui="memory-override">
			<select
				aria-label="Digest model"
				onchange={(event) => void memory.setModel(event.currentTarget.value)}
			>
				<option value={inheritModel} selected={selectedModel === inheritModel}>
					Use global ({defaultLabel})
				</option>
				<option value={noModel} selected={selectedModel === noModel}>
					Off for this workspace
				</option>
				{#each models as model (`${model.provider}/${model.id}`)}
					{@const ref = `${model.provider}/${model.id}`}
					<option value={ref} selected={selectedModel === ref}>
						{model.provider} · {model.name}
					</option>
				{/each}
			</select>
			<!-- Always rendered so the row's height stays constant; hidden when
				the setting has no override to clear. -->
			<Button
				size="sm"
				variant="ghost"
				disabled={!modelOverridden}
				data-hidden={!modelOverridden || undefined}
				onclick={() => void memory.setModel(inheritModel)}>Use global</Button
			>
		</div>
	</SettingField>

	<SettingField label="Digest new segments automatically">
		{#snippet detail()}
			{autoOverridden ? 'Overridden' : 'Inherits global'} · {auto
				? 'on'
				: 'off'}
		{/snippet}
		<div data-ui="memory-override">
			<Switch.Root
				data-ui="switch"
				checked={auto}
				aria-label="Digest new segments automatically"
				onCheckedChange={(next: boolean) => void memory.setAuto(next)}
			>
				<Switch.Thumb data-ui="switch-thumb" />
			</Switch.Root>
			<Button
				size="sm"
				variant="ghost"
				disabled={!autoOverridden}
				data-hidden={!autoOverridden || undefined}
				onclick={() => void memory.setAuto(undefined)}>Use global</Button
			>
		</div>
	</SettingField>
</div>
