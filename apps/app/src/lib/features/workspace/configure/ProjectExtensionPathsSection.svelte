<script lang="ts">
	import type { ProjectConfig } from '@gizmo/protocol';
	import type { AgentStore } from '../../../agent-client';
	import { Button, ResourceNote } from '../../../components';
	import ConfigureSectionHeading from './ConfigureSectionHeading.svelte';
	import type { ReapplyProjectConfig } from './types';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		config: ProjectConfig;
		onReapply: ReapplyProjectConfig;
	}

	let { store, workspacePath, config, onReapply }: Props = $props();

	let paths = $derived(config.piExtensionPaths ?? []);
	let draft = $state('');
	let saving = $state(false);

	function submit(next: string[]) {
		saving = true;
		onReapply(
			store.setProjectExtensionPaths(workspacePath, next).finally(() => {
				saving = false;
			}),
		);
	}

	function addPath() {
		const value = draft.trim();
		if (!value || paths.includes(value)) return;
		draft = '';
		submit([...paths, value]);
	}

	function removePath(path: string) {
		submit(paths.filter((entry) => entry !== path));
	}
</script>

<ConfigureSectionHeading
	title="Project extensions"
	description="Pi extension files or directories loaded only for this workspace's sessions. Listing a path is the opt-in — nothing is discovered from the workspace itself. Takes effect for new threads or after Reload runtime."
/>
<div data-ui="settings-card">
	{#if paths.length === 0}
		<ResourceNote
			>No project extensions. Add an absolute file or directory path below.</ResourceNote
		>
	{:else}
		<div data-ui="integration-list" data-layout="workspace-setup">
			{#each paths as path (path)}
				<div data-ui="integration-row">
					<span>
						<strong>{path}</strong>
					</span>
					<Button
						size="sm"
						variant="ghost"
						disabled={saving}
						onclick={() => removePath(path)}>Remove</Button
					>
				</div>
			{/each}
		</div>
	{/if}
	<div data-ui="integration-row">
		<input
			type="text"
			placeholder="/absolute/path/to/extension.ts"
			bind:value={draft}
			disabled={saving}
			onkeydown={(event) => {
				if (event.key === 'Enter') addPath();
			}}
		/>
		<Button size="sm" disabled={saving || !draft.trim()} onclick={addPath}
			>Add</Button
		>
	</div>
</div>
