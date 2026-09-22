<script lang="ts">
	import type { ProjectConfig, WorkspaceExtension } from '@gizmo/protocol';
	import type { AgentStore } from '../../../agent-client';
	import { Button } from '../../../components';
	import type { ReapplyProjectConfig } from './types';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		config: ProjectConfig;
		/** Entries the workspace-extensions section already accounts for. */
		found: WorkspaceExtension[];
		onReapply: ReapplyProjectConfig;
	}

	let { store, workspacePath, config, found, onReapply }: Props = $props();

	let paths = $derived(config.piExtensionPaths ?? []);
	// Everything the workspace loads from somewhere other than its own
	// extensions folder — including a stale entry whose folder is gone, so
	// the only screen that can clear it is this one.
	let extra = $derived(
		paths.filter((path) => !found.some((entry) => entry.path === path)),
	);
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
</script>

<!-- Folded: most workspaces load nothing from outside themselves, and an
	empty add-a-path form is not worth the room on the way down the page. -->
<details data-ui="path-disclosure" open={extra.length > 0}>
	<summary>
		<span>Extensions from elsewhere</span>
		<small>{extra.length || 'none'}</small>
	</summary>
	<div data-ui="path-panel">
		<p>
			Absolute paths to extensions living outside this workspace, or paths
			relative to its root. Listed here they load for this workspace only,
			exactly like the ones in its extensions folder.
		</p>
		{#if extra.length}
			<div data-ui="path-list">
				{#each extra as path (path)}
					<div data-ui="path-row">
						<code title={path}>{path}</code>
						<Button
							size="sm"
							variant="ghost"
							disabled={saving}
							onclick={() => submit(paths.filter((entry) => entry !== path))}
							>Remove</Button
						>
					</div>
				{/each}
			</div>
		{/if}
		<div data-ui="path-add">
			<input
				type="text"
				placeholder="/absolute/path/to/extension.ts"
				aria-label="Extension path"
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
</details>
