<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import { Tabs } from '../components';
	import { activateProjectExtensions, webExtensions } from './registry.svelte';
	import type { WebExtensionRuntime } from './types';
	import PanelToggle from '../features/shell/PanelToggle.svelte';
	import type { WorkspaceView } from './types';

	let {
		store,
		view,
		hidden,
		onCollapse,
	}: {
		store: AgentStore;
		view: WorkspaceView;
		hidden: boolean;
		/** Absent while the inspector is collapsed: its rail owns the control. */
		onCollapse?: () => void;
	} = $props();

	// The workspace a switch resets the inspector to its default tab, mirroring
	// the per-domain inspector this replaced (which remounted on that switch).
	let inspectorKey = $derived(
		`${view.workspacePath ?? ''}:${view.panel?.id ?? view.domainId ?? 'workspace'}`,
	);
	let defaultTab = $derived(view.panel?.id ?? 'git');
	let activeDomainPanel = $state('status');
	let extensionRuntimes = $state<WebExtensionRuntime[]>([]);
	let extensionTabs = $derived(
		extensionRuntimes.flatMap((runtime) => runtime.inspectorTabs),
	);

	// The inspector shell and its base tabs are app-owned; a domain or extension
	// only contributes its own tabs, never the whole panel.
	$effect(() => {
		const projectPath = view.workspacePath;
		const descriptors = store.projectExtensions;
		const runtimes = projectPath
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

	// The inspector shell is app-owned; extensions contribute their own tabs.
	// Reading the store here keeps badges (like Git's change count) reactive.
	let tabs = $derived([
		...(view.panel
			? [
					{
						value: view.panel.id,
						label: view.panel.label,
						badge: undefined,
						component: undefined,
						props: {},
					},
				]
			: []),
		...webExtensions()
			.flatMap(
				(definition) =>
					definition.inspectorTabs?.({
						store,
						projectPath: view.workspacePath,
						toolActivity: view.toolActivity,
					}) ?? [],
			)
			.map((tab) => ({
				value: tab.id,
				label: tab.label,
				badge: tab.badge,
				component: tab.component,
				props: tab.props,
			})),
	]);

	let pill = $derived(view.pill ?? { state: 'ready', label: 'Ready' });

	$effect(() => {
		if (
			activeDomainPanel !== 'status' &&
			!extensionTabs.some((tab) => tab.id === activeDomainPanel)
		)
			activeDomainPanel = 'status';
	});
</script>

<aside
	data-ui="inspector"
	data-context-kind={view.panel ? view.domainId : 'workspace'}
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
				<div data-ui="inspector-panel" data-panel={value}>
					{#if view.panel && value === view.panel.id}
						{@const Panel = view.panel.component}
						<Panel
							{...view.panel.props}
							{extensionTabs}
							activePanel={activeDomainPanel}
							onSelectPanel={(panel: string) => (activeDomainPanel = panel)}
						/>
					{:else if tabs.some((tab) => tab.value === value)}
						{@const tab = tabs.find((tab) => tab.value === value)!}
						{@const Panel = tab.component}
						<Panel {...tab.props} {store} projectPath={view.workspacePath} />
					{/if}
				</div>
			{/snippet}
		</Tabs>
	{/key}
</aside>
