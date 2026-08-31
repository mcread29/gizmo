<script lang="ts">
	import type { CommandContribution } from '../../../extensions/types';
	import {
		FolderOpen,
		Plus,
		Puzzle,
		RefreshCw,
		Search,
		Settings,
	} from '@lucide/svelte';
	import { Command } from 'bits-ui';
	import PaletteFooter from './PaletteFooter.svelte';

	interface Props {
		extensionCommands: CommandContribution[];
		onOpenWorkspace: () => void;
		onNewThread: () => void;
		onOpenSettings: () => void;
		onReloadExtensions: () => void;
		onSearchThreads: () => void;
		onClose: () => void;
	}

	let {
		extensionCommands,
		onOpenWorkspace,
		onNewThread,
		onOpenSettings,
		onReloadExtensions,
		onSearchThreads,
		onClose,
	}: Props = $props();

	let query = $state('');

	function run(action: () => void) {
		return () => {
			action();
			onClose();
		};
	}
</script>

<Command.Root shouldFilter loop>
	<div data-ui="palette-input">
		<Command.Input
			bind:value={query}
			autofocus
			placeholder="Type a command or search folders…"
		/>
	</div>

	<Command.List data-ui="palette-results">
		<Command.Empty data-ui="palette-empty">No matching commands.</Command.Empty>
		<Command.Group>
			<Command.GroupItems>
				<Command.Item
					data-ui="palette-result"
					value="open-workspace"
					keywords={['folder', 'project', 'directory']}
					onSelect={onOpenWorkspace}
				>
					<FolderOpen size={15} />
					<span data-ui="palette-result-name">Open workspace…</span>
				</Command.Item>
				<Command.Item
					data-ui="palette-result"
					value="new-thread"
					onSelect={run(onNewThread)}
				>
					<Plus size={15} />
					<span data-ui="palette-result-name">New thread</span>
				</Command.Item>
				<Command.Item
					data-ui="palette-result"
					value="open-settings"
					onSelect={run(onOpenSettings)}
				>
					<Settings size={15} />
					<span data-ui="palette-result-name">Open settings</span>
				</Command.Item>
				<Command.Item
					data-ui="palette-result"
					value="reload-extensions"
					keywords={['refresh', 'plugins', 'integrations']}
					onSelect={run(onReloadExtensions)}
				>
					<RefreshCw size={15} />
					<span data-ui="palette-result-name">Reload extensions</span>
				</Command.Item>
				<Command.Item
					data-ui="palette-result"
					value="search-threads"
					keywords={['find', 'filter']}
					onSelect={run(onSearchThreads)}
				>
					<Search size={15} />
					<span data-ui="palette-result-name">Search threads</span>
				</Command.Item>
			</Command.GroupItems>
		</Command.Group>

		{#if extensionCommands.length > 0}
			<Command.Group>
				<Command.GroupHeading data-ui="palette-group-heading">
					Extensions
				</Command.GroupHeading>
				<Command.GroupItems>
					{#each extensionCommands as command (command.id)}
						<Command.Item
							data-ui="palette-result"
							value={command.id}
							keywords={command.keywords}
							onSelect={run(command.run)}
						>
							{#if command.icon}
								{@const Icon = command.icon}
								<Icon size={15} />
							{:else}
								<Puzzle size={15} />
							{/if}
							<span data-ui="palette-result-name">{command.label}</span>
						</Command.Item>
					{/each}
				</Command.GroupItems>
			</Command.Group>
		{/if}
	</Command.List>
</Command.Root>

<PaletteFooter mode="root" />
