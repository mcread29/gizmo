<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import { Tabs } from '../components';
	import { activateProjectExtensions } from '../extensions/registry';
	import type { WebExtensionRuntime } from '../extensions/types';
	import ChangesPanel from '../features/changes/ChangesPanel.svelte';
	import PanelToggle from '../features/shell/PanelToggle.svelte';
	import ActivityPanel from '../features/unity/ActivityPanel.svelte';
	import UnityPanel from '../features/unity/UnityPanel.svelte';
	import type { ActiveWorkspaceView } from './workspace-view';

	let {
		store,
		view,
		hidden,
		onCollapse,
	}: {
		store: AgentStore;
		view: ActiveWorkspaceView;
		hidden: boolean;
		/** Absent while the inspector is collapsed: its rail owns the control. */
		onCollapse?: () => void;
	} = $props();

	let changeCount = $derived(store.gitStatus?.files.length ?? 0);
	// The workspace a switch resets the inspector to its default tab, mirroring
	// the per-domain inspector this replaced (which remounted on that switch).
	let inspectorKey = $derived(
		`${view.workspacePath ?? ''}:${view.unity ? 'unity' : (view.domainId ?? 'workspace')}`,
	);
	let defaultTab = $derived(view.unity ? 'unity' : 'changes');
	let activeUnityPanel = $state('status');
	let extensionRuntimes = $state<WebExtensionRuntime[]>([]);
	let extensionTabs = $derived(
		extensionRuntimes.flatMap((runtime) => runtime.inspectorTabs),
	);

	// The inspector shell and its base tabs are app-owned; a domain or extension
	// only contributes its own tabs, never the whole panel.
	$effect(() => {
		const projectPath = view.workspacePath;
		const descriptors = store.projectExtensions;
		const runtimes = projectPath && view.unity
			? activateProjectExtensions(descriptors, {
					projectPath,
					invoke: (extensionId, operation, input) =>
						store.invokeProjectExtension(
							projectPath,
							extensionId,
							operation,
							input,
						),
				})
			: [];
		extensionRuntimes = runtimes;
		return () => runtimes.forEach((runtime) => runtime.dispose());
	});

	let tabs = $derived([
		...(view.unity ? [{ value: 'unity', label: 'Unity' }] : []),
		{ value: 'changes', label: 'Files', badge: changeCount },
		{ value: 'activity', label: 'Activity' },
	]);

	let pill = $derived(view.unity?.lifecycle ?? { state: 'ready', label: 'Ready' });

	$effect(() => {
		if (
			activeUnityPanel !== 'status' &&
			!extensionTabs.some((tab) => tab.id === activeUnityPanel)
		)
			activeUnityPanel = 'status';
	});

</script>

<aside
	data-ui="inspector"
	data-context-kind={view.domainId === 'unity' ? 'unity' : 'workspace'}
	data-context-value={view.workspacePath}
	aria-label="Workspace inspector"
	inert={hidden || undefined}
>
	<div data-ui="inspector-header">
		<div>
			<h2>{view.workspaceName}</h2>
		</div>
		<span data-ui="status-pill" data-state={pill.state}
			><span></span>{pill.label}</span
		>
		{#if onCollapse}
			<PanelToggle side="right" expanded onToggle={onCollapse} />
		{/if}
	</div>

	{#key inspectorKey}
		<Tabs variant="subtab" lazy items={tabs} value={defaultTab}>
			{#snippet children(value)}
				<div
					data-ui="inspector-panel"
					data-panel={value}
				>
					{#if value === 'unity' && view.unity}
						<UnityPanel
							view={view.unity}
							{store}
							{extensionTabs}
							activePanel={activeUnityPanel}
							onSelectPanel={(panel) => (activeUnityPanel = panel)}
							onOpenProject={() => store.openSelectedProject()}
						/>
					{:else if value === 'changes'}
						<ChangesPanel {store} projectPath={view.workspacePath} />
					{:else}
						<ActivityPanel {view} />
					{/if}
				</div>
			{/snippet}
		</Tabs>
	{/key}
</aside>
