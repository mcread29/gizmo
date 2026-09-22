<script lang="ts">
	import { Switch } from 'bits-ui';
	import type { ProjectConfig, WorkspaceExtension } from '@gizmo/protocol';
	import type { AgentStore } from '../../../agent-client';
	import { Button, ResourceNote } from '../../../components';
	import ConfigureSectionHeading from './ConfigureSectionHeading.svelte';
	import type { ReapplyProjectConfig } from './types';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		config: ProjectConfig;
		/** What the workspace's own extensions folder holds right now. */
		found: WorkspaceExtension[];
		onReapply: ReapplyProjectConfig;
		onRescan: () => void;
	}

	let { store, workspacePath, config, found, onReapply, onRescan }: Props =
		$props();

	let paths = $derived(config.piExtensionPaths ?? []);
	let busy = $state<string>();

	// What a workspace loads is its path list, so the switch is a list edit:
	// the row's stored path joins it, or leaves it. Found but unlisted is the
	// resting state — a folder appearing on disk never runs anything.
	function toggle(extension: WorkspaceExtension, load: boolean) {
		busy = extension.id;
		onReapply(
			store
				.setProjectExtensionPaths(
					workspacePath,
					load
						? [...paths, extension.path]
						: paths.filter((path) => path !== extension.path),
				)
				.finally(() => {
					busy = undefined;
				}),
		);
	}
</script>

<ConfigureSectionHeading
	title="Workspace extensions"
	description="Pi extensions kept in this workspace's .gizmo/extensions folder. Gizmo lists what it finds; switching one on is what loads it, for this workspace's sessions only. Takes effect for new threads or after Reload runtime."
/>
<div data-ui="settings-card">
	{#if found.length === 0}
		<ResourceNote>
			Nothing in <code>.gizmo/extensions</code>. A folder with an
			<code>index.ts</code>, or a single <code>.ts</code> file, shows up here.
		</ResourceNote>
	{:else}
		<div data-ui="integration-list" data-layout="workspace-setup">
			{#each found as extension (extension.path)}
				{@const loaded = paths.includes(extension.path)}
				<div data-ui="integration-row" data-changed={loaded || undefined}>
					<label>
						<Switch.Root
							data-ui="switch"
							checked={loaded}
							disabled={busy === extension.id}
							aria-label={`Load ${extension.id} here`}
							onCheckedChange={(checked) => toggle(extension, checked)}
						>
							<Switch.Thumb data-ui="switch-thumb" />
						</Switch.Root>
						<span>
							<strong>{extension.id}</strong>
							<small title={extension.path}
								>{loaded ? 'Loaded here' : 'Found · not loaded'}</small
							>
						</span>
					</label>
				</div>
			{/each}
		</div>
	{/if}
	<div data-ui="card-footer">
		<small>Read when the workspace opens.</small>
		<Button size="sm" variant="ghost" onclick={onRescan}>Rescan folder</Button>
	</div>
</div>
