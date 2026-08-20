<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import { Tabs } from '../components';
	import ChangesPanel from '../features/changes/ChangesPanel.svelte';
	import ActivityPanel from '../features/unity/ActivityPanel.svelte';
	import type { ActiveWorkspaceView } from './workspace-view';

	let {
		store,
		view,
		hidden,
	}: { store: AgentStore; view: ActiveWorkspaceView; hidden: boolean } =
		$props();
	let tab = $state('changes');
	let tabs = $derived([
		{
			value: 'changes',
			label: 'Changes',
			shortLabel: 'Files',
			badge: store.gitStatus?.files.length ?? 0,
		},
		{ value: 'activity', label: 'Activity', shortLabel: 'Runs' },
	]);
</script>

<aside
	data-ui="inspector"
	data-context-kind="workspace"
	data-context-value={view.workspacePath}
	aria-label="Workspace inspector"
	inert={hidden || undefined}
>
	<div data-ui="inspector-header">
		<div>
			<span data-ui="eyebrow"
				>{view.domainId === 'svelte' ? 'Svelte workspace' : 'Workspace'}</span
			>
			<h2>{view.workspaceName}</h2>
		</div>
		<span data-ui="status-pill" data-state="ready"><span></span>READY</span>
	</div>
	<Tabs variant="inspector" lazy items={tabs} bind:value={tab}>
		{#snippet children(value)}
			<div data-ui="inspector-panel" data-panel={value}>
				{#if value === 'changes'}
					<ChangesPanel {store} projectPath={view.workspacePath} />
				{:else}
					<ActivityPanel {view} />
				{/if}
			</div>
		{/snippet}
	</Tabs>
</aside>
