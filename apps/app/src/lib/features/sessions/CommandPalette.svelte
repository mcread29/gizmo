<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import { webExtensions } from '../../extensions/registry.svelte';
	import { toasts } from '../../toasts.svelte';
	import { Dialog } from 'bits-ui';
	import CommandPaletteContent from './command-palette/CommandPaletteContent.svelte';
	import type { CommandPaletteMode } from './command-palette/types';

	interface Props {
		open?: boolean;
		initialMode?: CommandPaletteMode;
		store: AgentStore;
		onSelectWorkspace: (projectPath: string) => void;
		onNewThread: () => void;
		onOpenSettings: () => void;
		onSearchThreads: () => void;
	}

	let {
		open = $bindable(false),
		initialMode = 'root',
		store,
		onSelectWorkspace,
		onNewThread,
		onOpenSettings,
		onSearchThreads,
	}: Props = $props();

	let extensionCommands = $derived(
		webExtensions()
			.filter(({ id }) => store.activeDomains.includes(id))
			.flatMap(
				(definition) =>
					definition.commands?.({
						store,
						projectPath: store.selectedProjectPath,
					}) ?? [],
			),
	);

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
