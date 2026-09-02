<script lang="ts">
	import { Switch } from 'bits-ui';
	import type { ProjectConfig, ProjectDomains } from '@gizmo/protocol';
	import type { AgentStore } from '../../../agent-client';
	import { Button, ResourceNote } from '../../../components';
	import ConfigureSectionHeading from './ConfigureSectionHeading.svelte';
	import type { ReapplyProjectConfig } from './types';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		available: ProjectDomains['domains'];
		config: ProjectConfig;
		busyExtension?: string;
		onBusy: (id: string) => void;
		onReapply: ReapplyProjectConfig;
	}

	let {
		store,
		workspacePath,
		available,
		config,
		busyExtension,
		onBusy,
		onReapply,
	}: Props = $props();

	function overrideFor(id: string) {
		return config.gizmoExtensions?.find((override) => override.id === id)
			?.enabled;
	}

	function globalState(id: string) {
		return (
			store.resources?.gizmoExtensions?.find((extension) => extension.id === id)
				?.enabled ?? true
		);
	}

	function toggleExtension(id: string, checked: boolean) {
		onBusy(id);
		onReapply(
			store.setProjectGizmoExtension(
				workspacePath,
				id,
				checked === globalState(id) ? null : checked,
			),
		);
	}

	function resetExtension(id: string) {
		onBusy(id);
		onReapply(store.setProjectGizmoExtension(workspacePath, id, null));
	}
</script>

<ConfigureSectionHeading
	title="Gizmo extensions"
	description="Installed globally and on by default; each workspace can override the global state."
/>
<div data-ui="settings-card">
	{#if available.length === 0}
		<ResourceNote>No Gizmo extensions are installed globally.</ResourceNote>
	{:else}
		<div data-ui="integration-list" data-layout="workspace-setup">
			{#each available as extension (extension.id)}
				{@const override = overrideFor(extension.id)}
				{@const globalOn = globalState(extension.id)}
				{@const effective = override ?? globalOn}
				<div
					data-ui="integration-row"
					data-changed={override !== undefined || undefined}
				>
					<label>
						<Switch.Root
							data-ui="switch"
							checked={effective}
							disabled={busyExtension === extension.id}
							aria-label={`${extension.name} enabled here`}
							onCheckedChange={(checked) =>
								toggleExtension(extension.id, checked)}
						>
							<Switch.Thumb data-ui="switch-thumb" />
						</Switch.Root>
						<span>
							<strong>{extension.name}</strong>
							<small>
								{override === undefined
									? `Inherits global · ${globalOn ? 'on' : 'off'}`
									: `Overridden · ${override ? 'on' : 'off'}`}
							</small>
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
