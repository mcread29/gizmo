<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import type { CommandContribution } from '../../extensions/commands';
	import { extensionUi } from '../../extensions/extension-ui.svelte';
	import { extensionIcon, hasExtensionIcon } from '../../extensions/icons';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import { toasts } from '../../toasts.svelte';
	import { Dialog } from 'bits-ui';
	import CommandPaletteContent from './command-palette/CommandPaletteContent.svelte';
	import type { CommandPaletteMode } from './command-palette/types';

	interface Props {
		open?: boolean;
		initialMode?: CommandPaletteMode;
		store: AgentStore;
		/** Where a command's view is opened: an inspector tab or a dialog. */
		layout: WorkspaceLayout;
		onSelectWorkspace: (projectPath: string) => void;
		onNewThread: () => void;
		onOpenSettings: () => void;
		onSearchThreads: () => void;
	}

	let {
		open = $bindable(false),
		initialMode = 'root',
		store,
		layout,
		onSelectWorkspace,
		onNewThread,
		onOpenSettings,
		onSearchThreads,
	}: Props = $props();

	let extensionCommands = $derived(
		extensionUi
			.commands()
			.map(({ extensionId, value }): CommandContribution => ({
				id: `${extensionId}.${value.id}`,
				label: value.label,
				keywords: value.keywords,
				...(hasExtensionIcon(value.icon)
					? { icon: extensionIcon(value.icon) }
					: {}),
				run: () => runCommand(extensionId, value.id, value.view),
			})),
	);

	/** A command either opens one of its extension's views or runs server-side. */
	function runCommand(
		extensionId: string,
		commandId: string,
		viewId: string | undefined,
	) {
		if (viewId) {
			const summary = extensionUi.viewSummary(extensionId, viewId);
			const id = `${extensionId}.${viewId}`;
			if (summary?.value.placement === 'modal') layout.openExtensionView = id;
			else {
				layout.activeInspectorTab = id;
				if (!layout.rightVisible) layout.toggleRight();
			}
			return;
		}
		const projectPath = store.selectedProjectPath;
		if (!projectPath) return;
		void store.client
			.runExtensionCommand(projectPath, extensionId, commandId, store.sessionId)
			.catch((error: unknown) =>
				toasts.show(
					error instanceof Error ? error.message : String(error),
					'danger',
				),
			);
	}

	async function reloadExtensions() {
		const diagnostics = await store.reloadExtensions();
		if (diagnostics.length > 0) {
			console.warn(...diagnostics);
			toasts.show('Extensions reloaded with warnings', 'warning');
			return;
		}
		toasts.show('Extensions reloaded');
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay data-ui="palette-overlay" />
		<Dialog.Content data-ui="palette-panel">
			<Dialog.Title data-ui="visually-hidden">Command palette</Dialog.Title>
			<Dialog.Description data-ui="visually-hidden">
				Search commands and folders
			</Dialog.Description>

			{#if open}
				{#key initialMode}
					<CommandPaletteContent
						{initialMode}
						{store}
						{extensionCommands}
						{onSelectWorkspace}
						{onNewThread}
						{onOpenSettings}
						onReloadExtensions={() => void reloadExtensions()}
						{onSearchThreads}
						onClose={() => (open = false)}
					/>
				{/key}
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
