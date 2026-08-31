<script lang="ts">
	import type { WorkspaceDirectoryListing } from '@gizmo/protocol';
	import { Folder, LoaderCircle, Pin, PinOff } from '@lucide/svelte';
	import { Command } from 'bits-ui';
	import { PinnedDirectoryStore } from '../pinned-directories.svelte';
	import { errorMessage, splitLocation } from './location';
	import PaletteFooter from './PaletteFooter.svelte';
	import type { WorkspacePaletteStore } from './types';

	interface Props {
		store: WorkspacePaletteStore;
		onBack: () => void;
		onWorkspaceAdded: (projectPath: string) => void;
	}

	let { store, onBack, onWorkspaceAdded }: Props = $props();

	let location = $state('');
	let resolvedRoot = $state<string>();
	let searchLocation = $derived(splitLocation(location, resolvedRoot));
	let results = $state<WorkspaceDirectoryListing['directories']>([]);
	let searching = $state(false);
	let detecting = $state(false);
	let addError = $state<string>();
	let input = $state<HTMLInputElement | null>(null);
	let selectedValue = $state('');
	const pins = new PinnedDirectoryStore();
	let requestToken = 0;

	$effect(() => {
		const { root, filter } = searchLocation;
		const token = ++requestToken;
		searching = true;
		const timer = setTimeout(async () => {
			try {
				const listing = await store.searchProjects(filter, root);
				if (token !== requestToken) return;
				results = listing.directories;
				resolvedRoot = listing.path;
			} catch (error) {
				if (token !== requestToken) return;
				addError = errorMessage(error);
			} finally {
				if (token === requestToken) searching = false;
			}
		}, 100);
		return () => clearTimeout(timer);
	});

	async function submit(selectedPath: string) {
		if (!selectedPath || detecting) return;
		detecting = true;
		addError = undefined;
		try {
			const project = await store.addProject(selectedPath);
			onWorkspaceAdded(project.path);
		} catch (error) {
			addError = errorMessage(error);
		} finally {
			detecting = false;
		}
	}

	function jumpTo(path: string) {
		const separator = path.includes('\\') ? '\\' : '/';
		location = `${path}${separator}`;
		input?.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && location) {
			event.preventDefault();
			const path = location.replace(/[\\/]+$/, '');
			if (path) void submit(path);
			return;
		}
		if (event.key === 'Tab') {
			const path = selectedValue.startsWith('pin:')
				? selectedValue.slice(4)
				: selectedValue;
			if (path) {
				event.preventDefault();
				jumpTo(path);
			}
			return;
		}
		if (event.key === 'Backspace' && !location) onBack();
	}
</script>

<Command.Root bind:value={selectedValue} shouldFilter={false} loop>
	<div data-ui="palette-input">
		<Command.Input
			bind:ref={input}
			bind:value={location}
			autofocus
			placeholder="Type a path, or search folders…"
			onkeydown={handleKeydown}
		/>
		{#if searching}
			<LoaderCircle size={14} data-ui="palette-spinner" />
		{/if}
	</div>

	<Command.List data-ui="palette-results">
		{#if !location && pins.paths.length > 0}
			<Command.Group>
				<Command.GroupHeading data-ui="palette-group-heading">
					Pinned
				</Command.GroupHeading>
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
			{#if searching}
				Searching…
			{:else if searchLocation.filter}
				No folders match "{searchLocation.filter}".
			{:else}
				No subfolders here.
			{/if}
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
						<span data-ui="palette-result-name">{directory.name}</span>
						<span data-ui="palette-result-path">{directory.path}</span>
						<button
							type="button"
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
							{#if pins.has(directory.path)}
								<PinOff size={13} />
							{:else}
								<Pin size={13} />
							{/if}
						</button>
					</Command.Item>
				{/each}
			</Command.GroupItems>
		</Command.Group>
	</Command.List>
</Command.Root>

<PaletteFooter mode="workspace" {location} />

{#if addError}<p data-ui="onboarding-error">{addError}</p>{/if}
