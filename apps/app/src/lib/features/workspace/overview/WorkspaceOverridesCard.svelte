<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import type { AgentStore } from '../../../agent-client';
	import { Button, ResourceNote } from '../../../components';
	import type { WorkspaceTab } from '../../../router.svelte';
	import type { WorkspaceConfiguration } from '../workspace-config.svelte';
	import {
		workspaceOverrides,
		type WorkspaceOverride,
	} from './workspace-overrides';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		configuration: WorkspaceConfiguration;
		onSelectTab: (tab: WorkspaceTab) => void;
	}

	let { store, workspacePath, configuration, onSelectTab }: Props = $props();

	let overrides = $derived(
		workspaceOverrides({
			skills:
				store.resources?.workspacePath === workspacePath
					? (store.resources?.skills ?? [])
					: [],
			extensions: store.resources?.extensions ?? [],
			gizmoExtensions: store.resources?.gizmoExtensions ?? [],
			config: configuration.config,
			toolPolicy: store.toolPolicy,
		}),
	);

	/*
	 * The tools override is edited further down this same page now, so its row
	 * scrolls to that section instead of asking for a tab that is already open.
	 */
	function open(override: WorkspaceOverride) {
		if (override.tab !== 'overview') {
			onSelectTab(override.tab);
			return;
		}
		document
			.querySelector('[data-ui="workspace-configure"]')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function revert(override: WorkspaceOverride) {
		if (override.kind === 'tools') {
			void store.setProjectToolPolicy(workspacePath, null);
			return;
		}
		const id = override.id;
		if (!id) return;
		if (override.kind === 'skill') {
			void configuration.reapply(
				store.setProjectSkill(workspacePath, id, null),
			);
			return;
		}
		// A domain with no Pi extension behind it is a leftover from the retired
		// profile system, and clears through the other setter.
		const known = store.resources?.extensions?.some(
			(extension) => extension.id === id,
		);
		void configuration.reapply(
			known
				? store.setProjectPiExtension(workspacePath, id, null)
				: store.setProjectGizmoExtension(workspacePath, id, null),
		);
	}
</script>

<section data-ui="workspace-overrides">
	<div data-ui="workspace-dashboard-section-heading">
		<h3>Overridden here{overrides.length ? ` (${overrides.length})` : ''}</h3>
		<span>Everything else follows your global settings</span>
	</div>
	{#if configuration.error}
		<ResourceNote tone="error">{configuration.error}</ResourceNote>
	{/if}
	{#if overrides.length === 0}
		<ResourceNote>
			Nothing is overridden — this workspace follows your global settings.
		</ResourceNote>
	{:else}
		<div data-ui="workspace-override-list">
			{#each overrides as override (override.key)}
				<div data-ui="workspace-override-row">
					<button
						data-ui="workspace-override-open"
						onclick={() => open(override)}
					>
						<span>
							<strong>{override.name}</strong>
							<small>{override.here} · {override.globally}</small>
						</span>
						<ArrowRight size={14} />
					</button>
					<Button size="sm" variant="ghost" onclick={() => revert(override)}
						>Use global</Button
					>
				</div>
			{/each}
		</div>
	{/if}
</section>
