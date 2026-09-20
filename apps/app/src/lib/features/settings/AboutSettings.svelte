<script lang="ts">
	import { protocolVersion } from '@gizmo/protocol';
	import { Button, ConfirmDialog, SettingField } from '../../components';
	import { shortcutHint } from '../shell/shortcuts';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import SettingsPage from './SettingsPage.svelte';

	interface Props {
		layout: WorkspaceLayout;
		version: string;
	}

	let { layout, version }: Props = $props();
	let confirmOpen = $state(false);

	const shortcuts = [
		['Command palette', shortcutHint('K')],
		['New thread', shortcutHint('N')],
		['Search threads', shortcutHint('⇧K')],
		['Find in thread', shortcutHint('F')],
		['Focus composer', shortcutHint('⇧L')],
		['Toggle threads', shortcutHint('B')],
		['Toggle inspector', shortcutHint('⇧B')],
		['Session tree', shortcutHint('⇧T')],
		['Settings', shortcutHint(',')],
	] as const;
</script>

<SettingsPage title="About">
	<div data-ui="settings-card">
		<SettingField label="Version" description="Protocol {protocolVersion}">
			<span data-ui="resource-detail">{version}</span>
		</SettingField>
	</div>

	<div data-ui="settings-card">
		<div data-ui="settings-section-header">
			<h3>Keyboard</h3>
			<span>Shortcuts available anywhere in the workspace.</span>
		</div>
		<dl data-ui="shortcut-list">
			{#each shortcuts as [label, keys] (label)}
				<div>
					<dt>{label}</dt>
					<dd><kbd>{keys}</kbd></dd>
				</div>
			{/each}
		</dl>
	</div>

	<div data-ui="settings-card">
		<SettingField
			label="Restore device settings"
			description="Resets appearance, chat, and context preferences. Skills, workspaces, and threads are untouched."
		>
			<Button variant="danger" size="sm" onclick={() => (confirmOpen = true)}
				>Restore defaults</Button
			>
		</SettingField>
	</div>
</SettingsPage>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Restore device settings?"
	description="Appearance, chat, and context preferences return to their defaults. Your skills, workspaces, and threads are not affected."
	confirmLabel="Restore defaults"
	onConfirm={() => layout.restoreDefaults()}
/>
