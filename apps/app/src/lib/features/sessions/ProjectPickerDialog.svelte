<script lang="ts">
	import {
		ArrowRight,
		Check,
		ChevronLeft,
		Folder,
		FolderOpen,
		LoaderCircle,
	} from '@lucide/svelte';
	import type {
		ProjectDomains,
		WorkspaceDirectoryListing,
		WorkspaceIntegration,
	} from '@unity-agent/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, Dialog } from '../../components';
	import { isDesktop, pickWorkspaceDirectory } from '../../desktop';

	interface Props {
		open?: boolean;
		store: AgentStore;
		onSelect: (
			projectPath: string,
			integrations: WorkspaceIntegration[],
		) => void;
	}

	let { open = $bindable(false), store, onSelect }: Props = $props();
	let detected = $state<ProjectDomains['domains']>([]);
	let detecting = $state(false);
	let addError = $state<string>();
	let directoryListing = $state<WorkspaceDirectoryListing>();
	let browsing = $state(false);

	$effect(() => {
		if (open && !directoryListing && !isDesktop()) void browseServer();
	});

	async function browseDesktop() {
		const selected = await pickWorkspaceDirectory();
		if (selected) await submit(selected);
	}

	async function submit(selected: string) {
		if (!selected || detecting) return;
		detecting = true;
		addError = undefined;
		try {
			detected = (await store.detectProject(selected)).domains.filter(
				({ detected }) => detected,
			);
			const integrations = detected.map(({ id, root }) => ({ id, root }));
			const project = await store.addProject(selected, integrations);
			onSelect(project.path, project.integrations);
		} catch (error) {
			addError = error instanceof Error ? error.message : String(error);
		} finally {
			detecting = false;
		}
	}

	async function browseServer(path?: string) {
		browsing = true;
		addError = undefined;
		try {
			directoryListing = await store.browseProjects(path);
		} catch (error) {
			addError = error instanceof Error ? error.message : String(error);
		} finally {
			browsing = false;
		}
	}

	function folderName(path: string) {
		return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
	}

	function useCurrentFolder() {
		if (directoryListing) void submit(directoryListing.path);
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
		{:else if !directoryListing}
			<div data-ui="folder-picker-loading">
				<LoaderCircle size={18} /> Loading folders…
			</div>
		{:else}
			<section data-ui="directory-browser" aria-label="Folder browser">
				<div data-ui="directory-browser-bar">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Parent folder"
						disabled={!directoryListing.parent || browsing}
						onclick={() => void browseServer(directoryListing?.parent)}
						><ChevronLeft size={16} /></Button
					>
					<span title={directoryListing.path}>{directoryListing.path}</span>
				</div>
				<div data-ui="directory-list">
					{#if browsing}
						{#each { length: 6 } as _, index (index)}<div
								data-ui="skeleton"
								data-shape="directory"
							></div>{/each}
					{:else if directoryListing.directories.length === 0}
						<p data-ui="directory-empty">This folder has no subfolders.</p>
					{:else}
						{#each directoryListing.directories as directory (directory.path)}
							<button
								data-ui="directory-option"
								onclick={() => void browseServer(directory.path)}
							>
								<Folder size={17} /><span>{directory.name}</span><ArrowRight
									size={14}
								/>
							</button>
						{/each}
					{/if}
				</div>
			</section>

			<div data-ui="folder-picker-footer">
				<span>
					<Folder size={15} />
					<strong>{folderName(directoryListing.path)}</strong>
				</span>
				<Button
					disabled={detecting || browsing}
					onclick={useCurrentFolder}
				>
					<Check size={14} /> {detecting ? 'Opening…' : 'Open folder'}
				</Button>
			</div>
		{/if}

		{#if addError}<p data-ui="onboarding-error">{addError}</p>{/if}
	</div>
</Dialog>
