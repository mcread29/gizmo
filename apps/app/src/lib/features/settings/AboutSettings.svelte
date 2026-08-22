<script lang="ts">
	import { protocolVersion } from '@gizmo/protocol';
	import { Button, ConfirmDialog } from '../../components';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import SettingsPage from './SettingsPage.svelte';

	interface Props {
		layout: WorkspaceLayout;
		version: string;
	}

	let { layout, version }: Props = $props();
	let confirmOpen = $state(false);

	const shortcuts = [
		['Command palette', 'Ctrl/⌘ K'],
		['New thread', 'Ctrl/⌘ N'],
		['Search threads', 'Ctrl/⌘ Shift K'],
		['Focus composer', 'Ctrl/⌘ Shift L'],
		['Toggle threads', 'Ctrl/⌘ B'],
		['Toggle inspector', 'Ctrl/⌘ Shift B'],
		['Session tree', 'Ctrl/⌘ Shift T'],
		['Settings', 'Ctrl/⌘ ,'],
	] as const;
</script>

<SettingsPage title="About" scope="Gizmo on this device">
	<div data-ui="settings-card">
		<div data-ui="setting-field">
			<div>
				<strong>Version</strong>
				<span>Protocol {protocolVersion}</span>
			</div>
			<span data-ui="resource-detail">{version}</span>
		</div>
	</div>

	<div data-ui="settings-card">
		<div data-ui="settings-section-header">
			<strong>Keyboard</strong>
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
		<div data-ui="setting-field">
			<div>
				<strong>Restore device settings</strong>
				<span
					>Resets appearance, chat, and context preferences. Skills, workspaces,
					and threads are untouched.</span
				>
			</div>
			<Button variant="danger" size="sm" onclick={() => (confirmOpen = true)}
				>Restore defaults</Button
			>
		</div>
	</div>
</SettingsPage>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Restore device settings?"
	description="Appearance, chat, and context preferences return to their defaults. Your skills, workspaces, and threads are not affected."
	confirmLabel="Restore defaults"
	onConfirm={() => layout.restoreDefaults()}
/>
