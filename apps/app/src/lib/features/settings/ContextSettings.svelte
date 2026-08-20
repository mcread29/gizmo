<script lang="ts">
	import { Slider } from 'bits-ui';
	import { SwitchField } from '../../components';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { layout }: { layout: WorkspaceLayout } = $props();

	function setRange(values: number[]) {
		const [retain, trigger] = values;
		if (retain === undefined || trigger === undefined || trigger - retain < 5)
			return;
		layout.compactionRetainPercent = retain;
		layout.autoCompactFillPercent = trigger;
	}
</script>

<SettingsPage
	title="Context"
	scope="Stored on this device · applies to new and resumed threads"
>
	<div data-ui="settings-card">
		<SwitchField
			bind:checked={layout.autoCompact}
			label="Auto-compact context"
			description="Summarize older work automatically before the model runs out of context."
		/>
		<div
			data-ui="setting-field"
			data-layout="stacked"
			data-state={layout.autoCompact ? 'enabled' : 'disabled'}
		>
			<div>
				<strong>Compaction range</strong>
				<span
					>Compaction starts at the upper mark and keeps complete turns down to
					the lower one.</span
				>
			</div>
			<div data-ui="context-range-values">
				<span
					><i data-kind="retain"></i>Retain {layout.compactionRetainPercent}%</span
				>
				<span
					><i data-kind="trigger"></i>Compact at {layout.autoCompactFillPercent}%</span
				>
			</div>
			<Slider.Root
				type="multiple"
				value={[layout.compactionRetainPercent, layout.autoCompactFillPercent]}
				min={5}
				max={95}
				step={5}
				disabled={!layout.autoCompact}
				onValueChange={setRange}
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
		</div>
	</div>
</SettingsPage>
