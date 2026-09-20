<script lang="ts">
	import type { DigestSettings } from '@gizmo/protocol';
	import { Switch } from 'bits-ui';
	import type { AgentStore } from '../../agent-client';
	import { ResourceNote, SettingField } from '../../components';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	/**
	 * The default every workspace falls back to. Only the default is edited
	 * here: what a particular workspace runs under is its own business, and
	 * lives on that workspace's Memory tab.
	 */
	let defaults = $state<DigestSettings>();
	let error = $state<string>();

	let models = $derived(store.availableModels);
	/**
	 * The current choice is marked on the options rather than set on the
	 * select: the list comes from an `{#each}` that renders after the select
	 * itself, so a value assigned to the element finds no option to match and
	 * leaves the control showing nothing. "No model" carries a sentinel
	 * because an empty value reads as "unset" to the same machinery.
	 */
	const noModel = 'none';
	let selected = $derived(
		defaults?.model
			? `${defaults.model.provider}/${defaults.model.id}`
			: noModel,
	);

	$effect(() => {
		if (store.connection !== 'connected') return;
		void load();
	});

	async function load() {
		try {
			defaults = (await store.memory.memorySettings()).defaults;
			error = undefined;
		} catch (cause) {
			error = message(cause);
		}
	}

	async function save(settings: DigestSettings) {
		// Shown before the round trip: this is a two-control page, and a select
		// that snaps back while the write is in flight reads as a rejection.
		defaults = settings;
		try {
			await store.memory.setMemoryDefaults(settings);
			error = undefined;
		} catch (cause) {
			error = message(cause);
			await load();
		}
	}

	function selectModel(value: string) {
		const separator = value.indexOf('/');
		void save({
			auto: defaults?.auto ?? true,
			...(value === noModel || separator < 1
				? {}
				: {
						model: {
							provider: value.slice(0, separator),
							id: value.slice(separator + 1),
						},
					}),
		});
	}

	function message(value: unknown) {
		return value instanceof Error ? value.message : String(value);
	}
</script>

<SettingsPage
	title="Memory"
	scope="Defaults for every workspace; each one can override them on its Memory tab"
>
	{#if error}
		<ResourceNote tone="error">{error}</ResourceNote>
	{/if}

	<div data-ui="settings-card">
		<SettingField
			label="Digest model"
			description="Summarizes each journal segment into what stays true afterwards, so search reads decisions instead of raw transcript. Nothing is digested without one."
			stacked
		>
			<select
				aria-label="Digest model"
				onchange={(event) => selectModel(event.currentTarget.value)}
			>
				<option value={noModel} selected={selected === noModel}>
					Off — do not digest
				</option>
				{#each models as model (`${model.provider}/${model.id}`)}
					{@const ref = `${model.provider}/${model.id}`}
					<option value={ref} selected={selected === ref}>
						{model.provider} · {model.name}
					</option>
				{/each}
			</select>
		</SettingField>

		<SettingField
			label="Digest new segments automatically"
			description="Each segment is digested as it is journaled. Failures are skipped and picked up by the next backfill."
		>
			<Switch.Root
				data-ui="switch"
				checked={defaults?.auto ?? true}
				aria-label="Digest new segments automatically"
				onCheckedChange={(auto: boolean) =>
					void save({
						auto,
						...(defaults?.model ? { model: defaults.model } : {}),
					})}
			>
				<Switch.Thumb data-ui="switch-thumb" />
			</Switch.Root>
		</SettingField>
	</div>
</SettingsPage>
