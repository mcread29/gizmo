<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import { SelectField, SettingField, SwitchField } from '../../components';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import KeyboardShortcuts from './KeyboardShortcuts.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { layout, store }: { layout: WorkspaceLayout; store: AgentStore } =
		$props();

	const off = 'off';

	/*
	 * The catalog is only loaded for the thread that is open, so a stored
	 * choice is kept in the list even when nothing can confirm it right now —
	 * otherwise opening settings without a thread would silently reset it.
	 */
	let options = $derived([
		{ value: off, label: 'Off', hint: 'Name threads after the first message' },
		...store.availableModels.map((model) => ({
			value: `${model.provider}/${model.id}`,
			label: model.name,
			hint: model.provider,
		})),
		...(layout.titleModel &&
		!store.availableModels.some(
			({ provider, id }) => `${provider}/${id}` === layout.titleModel,
		)
			? [{ value: layout.titleModel, label: layout.titleModel, hint: 'Stored' }]
			: []),
	]);
	let selected = $derived(layout.titleModel || off);
</script>

<SettingsPage title="Chat">
	<div data-ui="settings-card">
		<SwitchField
			bind:checked={layout.sendOnEnter}
			label="Send with Enter"
			description="Press Shift+Enter for a new line. When off, use Ctrl or Command+Enter to send. On a touch keyboard Enter always adds a new line; tap Send instead."
		/>
		<SwitchField
			bind:checked={layout.autoFollowOutput}
			label="Follow agent output"
		/>
		<SwitchField
			bind:checked={layout.expandReasoning}
			label="Expand reasoning"
			description="Reasoning is often longer than the reply. When off, it stays folded behind a single line you can open."
		/>
	</div>

	<div data-ui="settings-card">
		<SettingField
			label="Thread name model"
			description="Names each new thread from its first message, once the first reply is done. Pick something small and cheap — a local model costs nothing to run. Threads you rename yourself are left alone."
		>
			<SelectField
				value={selected}
				{options}
				label="Thread name model"
				onValueChange={(value) =>
					(layout.titleModel = value === off ? '' : value)}
			/>
		</SettingField>
	</div>

	<KeyboardShortcuts />
</SettingsPage>
