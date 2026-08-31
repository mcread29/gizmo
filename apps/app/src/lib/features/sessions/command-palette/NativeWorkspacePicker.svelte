<script lang="ts">
	import { FolderOpen } from '@lucide/svelte';
	import { Button } from '../../../components';
	import { pickWorkspaceDirectory } from '../../../desktop';
	import { errorMessage } from './location';
	import type { WorkspacePaletteStore } from './types';

	interface Props {
		store: WorkspacePaletteStore;
		onWorkspaceAdded: (projectPath: string) => void;
	}

	let { store, onWorkspaceAdded }: Props = $props();
	let detecting = $state(false);
	let addError = $state<string>();

	async function browse() {
		const selectedPath = await pickWorkspaceDirectory();
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
</script>

<div data-ui="native-folder-picker">
	<FolderOpen size={28} />
	<p>Choose a folder with the system folder picker.</p>
	<Button disabled={detecting} onclick={() => void browse()}>
		{detecting ? 'Opening…' : 'Choose folder'}
	</Button>
</div>

{#if addError}<p data-ui="onboarding-error">{addError}</p>{/if}
