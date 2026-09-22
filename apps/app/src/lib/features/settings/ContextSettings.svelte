<script lang="ts">
	import { Slider } from 'bits-ui';
	import type { CompactionPolicy } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { SettingField, SwitchField } from '../../components';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	const policy = $derived(store.compactionPolicy);
	const workspace = $derived(
		store.projects.find(({ path }) => path === store.selectedProjectPath)
			?.title,
	);
	let error = $state<string>();
	/** Thumb positions while dragging; the store's values once released. */
	let dragging = $state<number[]>();
	const range = $derived(
		dragging ?? [policy.retainPercent, policy.fillPercent],
	);

	/*
	 * The policy belongs to the workspace and the server owns it, so every
	 * edit is a request; the store applies it optimistically and reverts on
	 * failure, and other clients follow from the broadcast.
	 */
	function save(next: CompactionPolicy) {
		error = undefined;
		store.setCompactionPolicy(next).catch((cause: unknown) => {
			error = cause instanceof Error ? cause.message : String(cause);
		});
	}

	function setRange(values: number[]) {
		dragging = undefined;
		const [retain, trigger] = values;
		if (
			retain === undefined ||
			trigger === undefined ||
			trigger < 10 ||
			trigger - retain < 5
		)
			return;
		if (retain === policy.retainPercent && trigger === policy.fillPercent)
			return;
		save({ ...policy, retainPercent: retain, fillPercent: trigger });
	}
</script>

<SettingsPage
	title="Context"
	scope={workspace
		? `Applies to every thread in ${workspace}, from every device`
		: 'Select a workspace to set its policy'}
>
	<div data-ui="settings-card">
		<SwitchField
			bind:checked={
				() => policy.enabled, (enabled) => save({ ...policy, enabled })
			}
			label="Auto-compact context"
			description="Summarize older work automatically before the model runs out of context."
		/>
		<SettingField
			label="Compaction range"
			description="Compaction starts at the upper mark and keeps complete turns down to the lower one. Retaining nothing lets a cut land inside the turn that crossed the line."
			stacked
			disabled={!policy.enabled}
		>
			<div data-ui="context-range-values">
				<span><i data-kind="retain"></i>Retain {range[0]}%</span>
				<span><i data-kind="trigger"></i>Compact at {range[1]}%</span>
			</div>
			<Slider.Root
				type="multiple"
				value={range}
				min={0}
				max={95}
				step={5}
				disabled={!policy.enabled}
				onValueChange={(values) => (dragging = values)}
				onValueCommit={setRange}
				data-ui="context-range"
			>
				<Slider.Range data-ui="context-range-fill" />
				<Slider.Thumb
					index={0}
					data-ui="context-range-thumb"
					aria-label="Context retained"
				/>
				<Slider.Thumb
					index={1}
					data-ui="context-range-thumb"
					aria-label="Auto-compaction threshold"
				/>
			</Slider.Root>
			{#if error}
				<strong role="alert">{error}</strong>
			{/if}
		</SettingField>
	</div>
</SettingsPage>
