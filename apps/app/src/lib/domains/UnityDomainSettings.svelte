<script lang="ts">
	import { compilePlayModePolicies } from '../app-settings';
	import { SelectField } from '../components';
	import SettingsSection from '../features/settings/SettingsSection.svelte';
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	let { layout }: { layout: WorkspaceLayout } = $props();
</script>

<SettingsSection
	title="Unity compilation"
	description="Choose what happens when an agent needs to compile while the Editor is in Play Mode."
>
	<SelectField
		value={layout.compilePlayModePolicy}
		label="When Play Mode is active"
		options={[...compilePlayModePolicies]}
		onValueChange={(value) => {
			if (value === 'ask' || value === 'stop' || value === 'keep_playing')
				layout.compilePlayModePolicy = value;
		}}
	/>
</SettingsSection>
