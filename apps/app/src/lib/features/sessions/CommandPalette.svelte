<script lang="ts">
	import {
		Folder,
		FolderOpen,
		LoaderCircle,
		Pin,
		PinOff,
		Plus,
		Puzzle,
		Search,
		Settings,
		X,
	} from '@lucide/svelte';
	import { Command, Dialog } from 'bits-ui';
	import type {
		ProjectDomains,
		WorkspaceDirectoryListing,
		WorkspaceIntegration,
	} from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import { isDesktop, pickWorkspaceDirectory } from '../../desktop';
	import { webExtensions } from '../../extensions/registry.svelte';
	import { PinnedDirectoryStore } from './pinned-directories.svelte';

	type Mode = 'root' | 'workspace';

	interface Props {
		open?: boolean;
		initialMode?: Mode;
		store: AgentStore;
		onSelectWorkspace: (
			projectPath: string,
			integrations: WorkspaceIntegration[],
		) => void;
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

	let mode = $state<Mode>('root');
	let detecting = $state(false);
	let addError = $state<string>();
	let query = $state('');
	let root = $state<string>();
	let results = $state<WorkspaceDirectoryListing['directories']>([]);
	let searching = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);
	let selectedValue = $state('');
	const pins = new PinnedDirectoryStore();

	let extensionCommands = $derived(
		webExtensions().flatMap(
			(definition) =>
				definition.commands?.({
					store,
					projectPath: store.selectedProjectPath,
				}) ?? [],
		),
	);

	let requestToken = 0;
	$effect(() => {
		if (mode !== 'workspace' || !open || isDesktop()) return;
		// Read reactively *before* the timeout so typing/scoping re-triggers this
		// effect — reading them inside the callback below would not track them.
		const search = query;
		const searchRoot = root;
		const token = ++requestToken;
		searching = true;
		const timer = setTimeout(async () => {
			try {
				const listing = await store.searchProjects(search, searchRoot);
				if (token !== requestToken) return;
				results = listing.directories;
			} catch (error) {
				if (token !== requestToken) return;
				addError = error instanceof Error ? error.message : String(error);
			} finally {
				if (token === requestToken) searching = false;
			}
		}, 100);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		if (open) {
			mode = initialMode;
			query = '';
			root = undefined;
			addError = undefined;
		}
	});

	async function browseDesktop() {
		const selectedPath = await pickWorkspaceDirectory();
		if (selectedPath) await submit(selectedPath);
	}

	async function submit(selectedPath: string) {
		if (!selectedPath || detecting) return;
		detecting = true;
		addError = undefined;
		try {
			const domains = (await store.detectProject(selectedPath)).domains.filter(
				({ detected }) => detected,
			);
			const integrations = domains.map(({ id, root }) => ({ id, root }));
			const project = await store.addProject(selectedPath, integrations);
			onSelectWorkspace(project.path, project.integrations);
			open = false;
		} catch (error) {
			addError = error instanceof Error ? error.message : String(error);
		} finally {
			detecting = false;
		}
	}

	function enterWorkspaceMode() {
		mode = 'workspace';
		query = '';
		inputEl?.focus();
	}

	function jumpTo(path: string) {
		root = path;
		query = '';
		inputEl?.focus();
	}

	function clearRoot() {
		root = undefined;
		query = '';
		inputEl?.focus();
	}

	function backToCommands() {
		mode = 'root';
		query = '';
		results = [];
		inputEl?.focus();
	}

	function folderName(path: string) {
		return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
	}

	function run(action: () => void) {
		return () => {
			action();
			open = false;
		};
	}

	function onInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Tab' && mode === 'workspace') {
			const path = selectedValue.startsWith('pin:')
				? selectedValue.slice(4)
				: selectedValue;
			if (path) {
				event.preventDefault();
				jumpTo(path);
			}
			return;
		}
		if (event.key !== 'Backspace' || query) return;
		if (mode === 'workspace' && root) clearRoot();
		else if (mode === 'workspace') backToCommands();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay data-ui="palette-overlay" />
		<Dialog.Content data-ui="palette-panel">
			<Dialog.Title data-ui="visually-hidden">Command palette</Dialog.Title>
			<Dialog.Description data-ui="visually-hidden"
				>Search commands and folders</Dialog.Description
			>
			{#if isDesktop() && mode === 'workspace'}
				<div data-ui="native-folder-picker">
					<FolderOpen size={28} />
					<p>Choose a folder with the system folder picker.</p>
					<Button disabled={detecting} onclick={() => void browseDesktop()}>
						{detecting ? 'Opening…' : 'Choose folder'}
					</Button>
				</div>
			{:else}
				<Command.Root
					bind:value={selectedValue}
					shouldFilter={mode === 'root'}
					loop
				>
					<div data-ui="palette-input">
						{#if mode === 'workspace' && root}
							<button data-ui="palette-scope" onclick={clearRoot}>
								<span data-ui="palette-scope-path">{root}</span>
								<X size={12} />
							</button>
						{/if}
						<Command.Input
							bind:ref={inputEl}
							bind:value={query}
							autofocus
							placeholder={mode === 'root'
								? 'Type a command or search folders…'
								: root
									? `Search in ${folderName(root)}…`
									: 'Search folders…'}
							onkeydown={onInputKeydown}
						/>
						{#if searching}<LoaderCircle size={14} data-ui="palette-spinner" />{/if}
					</div>

					<Command.List data-ui="palette-results">
						{#if mode === 'root'}
							<Command.Empty data-ui="palette-empty"
								>No matching commands.</Command.Empty
							>
							<Command.Group>
								<Command.GroupItems>
									<Command.Item
										data-ui="palette-result"
										value="open-workspace"
										keywords={['folder', 'project', 'directory']}
										onSelect={enterWorkspaceMode}
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
									<Command.GroupHeading data-ui="palette-group-heading"
										>Extensions</Command.GroupHeading
									>
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
												<span data-ui="palette-result-name"
													>{command.label}</span
												>
											</Command.Item>
										{/each}
									</Command.GroupItems>
								</Command.Group>
							{/if}
						{:else}
							{#if !query && !root && pins.paths.length > 0}
								<Command.Group>
									<Command.GroupHeading data-ui="palette-group-heading"
									>Pinned</Command.GroupHeading
								>
									<Command.GroupItems>
										{#each pins.paths as path (path)}
											<Command.Item
												data-ui="palette-result"
												value={`pin:${path}`}
												onSelect={() => jumpTo(path)}
											>
												<Folder size={15} />
												<span data-ui="palette-result-path">{path}</span>
											</Command.Item>
										{/each}
									</Command.GroupItems>
								</Command.Group>
							{/if}

							<Command.Empty data-ui="palette-empty">
								{#if searching}Searching…{:else if query}No folders match "{query}".{:else}No
									subfolders here.{/if}
							</Command.Empty>

							<Command.Group>
								<Command.GroupItems>
									{#each results as directory (directory.path)}
										<Command.Item
											data-ui="palette-result"
											value={directory.path}
											onSelect={() => void submit(directory.path)}
										>
											<Folder size={15} />
											<span data-ui="palette-result-name"
												>{directory.name}</span
											>
											<span data-ui="palette-result-path"
												>{directory.path}</span
											>
											<span
												role="button"
												tabindex="-1"
												data-ui="palette-pin-toggle"
												aria-label={pins.has(directory.path)
													? 'Unpin folder'
													: 'Pin folder'}
												onclick={(event) => {
													event.stopPropagation();
													pins.toggle(directory.path);
												}}
												onkeydown={(event) => event.stopPropagation()}
											>
												{#if pins.has(directory.path)}<PinOff
														size={13}
													/>{:else}<Pin size={13} />{/if}
											</span>
										</Command.Item>
									{/each}
								</Command.GroupItems>
							</Command.Group>
						{/if}
					</Command.List>
				</Command.Root>

				<div data-ui="palette-footer">
					<span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
					{#if mode === 'workspace'}
						<span><kbd>Tab</kbd> Open folder</span>
						<span><kbd>Backspace</kbd> Back</span>
					{/if}
					<span><kbd>Esc</kbd> Close</span>
					<span data-ui="palette-footer-primary"
						><kbd>Enter</kbd> {mode === 'root' ? 'Select' : 'Add'}</span
					>
				</div>
			{/if}

			{#if addError}<p data-ui="onboarding-error">{addError}</p>{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
