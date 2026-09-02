<script lang="ts">
	import { Switch } from 'bits-ui';
	import type { ProjectConfig } from '@gizmo/protocol';
	import type { AgentStore } from '../../../agent-client';
	import { Button, ResourceNote } from '../../../components';
	import ConfigureSectionHeading from './ConfigureSectionHeading.svelte';
	import type { ReapplyProjectConfig } from './types';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		config: ProjectConfig;
		busyExtension?: string;
		onBusy: (id: string) => void;
		onReapply: ReapplyProjectConfig;
	}

	let {
		store,
		workspacePath,
		config,
		busyExtension,
		onBusy,
		onReapply,
	}: Props = $props();

	let extensions = $derived(store.resources?.extensions ?? []);

	function overrideFor(id: string) {
		return config.piExtensions?.find((override) => override.id === id)?.enabled;
	}

	function toggleExtension(id: string, checked: boolean) {
		onBusy(id);
		onReapply(
			store.setProjectPiExtension(workspacePath, id, checked ? null : false),
		);
	}

	function resetExtension(id: string) {
		onBusy(id);
		onReapply(store.setProjectPiExtension(workspacePath, id, null));
	}
</script>

<ConfigureSectionHeading
	title="Pi extensions"
	description="Enable or disable globally in Settings → Agent; a workspace can only turn an on extension off."
/>
<div data-ui="settings-card">
	{#if extensions.length === 0}
		<ResourceNote>No global Pi extensions found.</ResourceNote>
	{:else}
		<div data-ui="integration-list" data-layout="workspace-setup">
			{#each extensions as extension (extension.id)}
				{@const override = overrideFor(extension.id)}
				{@const effective = override ?? extension.enabled}
				<div
					data-ui="integration-row"
					data-changed={override !== undefined || undefined}
				>
					<label>
						<Switch.Root
							data-ui="switch"
							checked={effective}
							disabled={!extension.enabled || busyExtension === extension.id}
							aria-label={`${extension.name} enabled here`}
							onCheckedChange={(checked) =>
								toggleExtension(extension.id, checked)}
						>
							<Switch.Thumb data-ui="switch-thumb" />
						</Switch.Root>
						<span>
							<strong>{extension.name}</strong>
							<small title={extension.path}
								>{extension.enabled
									? override === undefined
										? 'Inherits global · on'
										: 'Overridden · off'
									: 'Off globally'}</small
							>
						</span>
					</label>
					<!-- Always rendered so the row's height stays constant; hidden
						when the row has no override to clear. -->
					<Button
						size="sm"
						variant="ghost"
						disabled={override === undefined || busyExtension === extension.id}
						data-hidden={override === undefined || undefined}
						onclick={() => resetExtension(extension.id)}>Use global</Button
					>
				</div>
			{/each}
		</div>
	{/if}
</div>
