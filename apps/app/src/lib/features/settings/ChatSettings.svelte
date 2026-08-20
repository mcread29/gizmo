<script lang="ts">
	import { SwitchField } from '../../components';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { layout }: { layout: WorkspaceLayout } = $props();
</script>

<SettingsPage title="Chat" scope="Stored on this device">
	<div data-ui="settings-card">
		<SwitchField
			bind:checked={layout.sendOnEnter}
			label="Send with Enter"
			description="Press Shift+Enter for a new line. When off, use Ctrl or Command+Enter to send."
		/>
		<SwitchField
			bind:checked={layout.autoFollowOutput}
			label="Follow agent output"
			description="Keep the newest response content in view while the agent is working."
		/>
		<SwitchField
			bind:checked={layout.expandReasoning}
			label="Expand reasoning"
			description="Reasoning is often longer than the reply. When off, it stays folded behind a single line you can open."
		/>
	</div>
</SettingsPage>
