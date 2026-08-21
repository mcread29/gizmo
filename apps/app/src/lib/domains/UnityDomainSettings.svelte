<script lang="ts">
	import { compilePlayModePolicies } from '../app-settings';
	import { SelectField } from '../components';
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	let { layout }: { layout: WorkspaceLayout } = $props();
</script>

<div data-ui="settings-card">
	<div data-ui="setting-field">
		<div>
			<strong>Unity compilation</strong>
			<span
				>What happens when an agent needs to compile while the Editor is in Play
				Mode.</span
			>
		</div>
		<SelectField
			value={layout.compilePlayModePolicy}
			label="When Play Mode is active"
			options={[...compilePlayModePolicies]}
			onValueChange={(value) => {
				if (value === 'ask' || value === 'stop' || value === 'keep_playing')
					layout.compilePlayModePolicy = value;
			}}
		/>
	</div>
</div>
