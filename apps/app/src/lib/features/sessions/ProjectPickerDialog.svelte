<script lang="ts">
	import {
		Folder,
		FolderOpen,
		LoaderCircle,
		Pin,
		PinOff,
		X,
	} from '@lucide/svelte';
	import type {
		ProjectDomains,
		WorkspaceDirectoryListing,
		WorkspaceIntegration,
	} from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, Dialog } from '../../components';
	import { isDesktop, pickWorkspaceDirectory } from '../../desktop';
	import { PinnedDirectoryStore } from './pinned-directories.svelte';

	interface Props {
		open?: boolean;
		store: AgentStore;
		onSelect: (
			projectPath: string,
			integrations: WorkspaceIntegration[],
		) => void;
	}

	let { open = $bindable(false), store, onSelect }: Props = $props();
	let detecting = $state(false);
	let addError = $state<string>();
	let query = $state('');
	let root = $state<string>();
	let results = $state<WorkspaceDirectoryListing['directories']>([]);
	let searching = $state(false);
	let selected = $state(0);
	let inputEl = $state<HTMLInputElement>();
	const pins = new PinnedDirectoryStore();

	let requestToken = 0;
	$effect(() => {
		if (!open || isDesktop()) return;
		const token = ++requestToken;
		searching = true;
		const timer = setTimeout(async () => {
			try {
				const listing = await store.searchProjects(query, root);
				if (token !== requestToken) return;
				results = listing.directories;
				selected = 0;
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
		if (open) inputEl?.focus();
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
			onSelect(project.path, project.integrations);
		} catch (error) {
			addError = error instanceof Error ? error.message : String(error);
		} finally {
			detecting = false;
		}
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

	function folderName(path: string) {
		return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			selected = Math.min(selected + 1, results.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selected = Math.max(selected - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const directory = results[selected];
			if (directory) void submit(directory.path);
		} else if (event.key === 'Backspace' && !query && root) {
			clearRoot();
		}
	}
</script>

<Dialog
	bind:open
	title="Open workspace"
	description="Choose a folder on this machine"
	size="md"
>
	{#snippet trigger(props)}<button
			{...props}
			data-ui="hidden-trigger"
			hidden
			tabindex="-1">Open workspace</button
		>{/snippet}

	<div data-ui="folder-picker">
		{#if isDesktop()}
			<div data-ui="native-folder-picker">
				<FolderOpen size={28} />
				<p>Choose a folder with the system folder picker.</p>
				<Button disabled={detecting} onclick={() => void browseDesktop()}>
					{detecting ? 'Opening…' : 'Choose folder'}
				</Button>
			</div>
		{:else}
			<div data-ui="palette">
				<div data-ui="palette-input">
					{#if root}
						<button data-ui="palette-scope" onclick={clearRoot}>
							{folderName(root)}<X size={12} />
						</button>
					{/if}
					<input
						bind:this={inputEl}
						bind:value={query}
						type="text"
						placeholder={root ? `Search in ${folderName(root)}…` : 'Search folders…'}
						onkeydown={onKeydown}
					/>
					{#if searching}<LoaderCircle size={14} data-ui="palette-spinner" />{/if}
				</div>

				{#if !query && !root && pins.paths.length > 0}
					<ul data-ui="palette-pins">
						{#each pins.paths as path (path)}
							<li>
								<button onclick={() => jumpTo(path)}>{path}</button>
							</li>
						{/each}
					</ul>
				{/if}

				<ul data-ui="palette-results">
					{#each results as directory, index (directory.path)}
						<li>
							<button
								data-ui="palette-result"
								data-active={index === selected}
								onmouseenter={() => (selected = index)}
								onclick={() => void submit(directory.path)}
							>
								<Folder size={15} />
								<span data-ui="palette-result-name">{directory.name}</span>
								<span data-ui="palette-result-path">{directory.path}</span>
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
							</button>
						</li>
					{:else}
						{#if !searching}
							<li data-ui="palette-empty">
								{query ? `No folders match "${query}".` : 'No subfolders here.'}
							</li>
						{/if}
					{/each}
				</ul>
			</div>
		{/if}

		{#if addError}<p data-ui="onboarding-error">{addError}</p>{/if}
	</div>
</Dialog>
