<script lang="ts">
	import type { View } from '@gizmo/extension-api';
	import type { AgentStore } from '../agent-client';
	import { Tabs, applyOrder } from '../components';
	import PanelToggle from '../features/shell/PanelToggle.svelte';
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	import ExtensionViewPanel from './ExtensionViewPanel.svelte';
	import { extensionUi } from './extension-ui.svelte';
	import { workspaceNameFromPath } from './workspace-label';

	let {
		store,
		layout,
		hidden,
		onCollapse,
		tabOrder = [],
		onReorderTabs,
	}: {
		store: AgentStore;
		/** Holds the client-local settings a view is opened with. */
		layout: WorkspaceLayout;
		hidden: boolean;
		/** Saved tab ids, applied ahead of contribution order. */
		tabOrder?: string[];
		onReorderTabs?: (ids: string[]) => void;
		/** Absent while the inspector is collapsed: its rail owns the control. */
		onCollapse?: () => void;
	} = $props();

	let projectPath = $derived(store.selectedProjectPath);
	let workspaceName = $derived(
		workspaceNameFromPath(projectPath) ?? 'Select a workspace',
	);

	/** The latest view per tab, for the badge the tab shows. */
	let views = $state<Record<string, View | undefined>>({});

	// Every enabled extension contributes peer tabs to the app-owned inspector;
	// none of them can own the shell.
	let tabs = $derived(
		applyOrder(
			extensionUi.inspectorViews(),
			tabOrder,
			({ extensionId, value }) => `${extensionId}.${value.id}`,
		).map(({ extensionId, value }) => {
			const id = `${extensionId}.${value.id}`;
			return {
				value: id,
				label: value.label,
				shortLabel: value.shortLabel,
				extensionId,
				viewId: value.id,
				// A thread-scoped view is opened for the thread on screen.
				sessionId: value.scope === 'thread' ? store.sessionId : undefined,
			};
		}),
	);
	let tabItems = $derived(
		tabs.map((tab) => ({
			...tab,
			badge: views[tab.value]?.badge,
			badgeTone: views[tab.value]?.badgeTone,
		})),
	);
	let defaultTab = $derived(tabs[0]?.value);

	// The active tab lives in the layout so a titlebar status item can bring
	// its view forward; it falls back whenever the current one goes away.
	$effect(() => {
		const active = layout.activeInspectorTab;
		if (active && tabs.some(({ value }) => value === active)) return;
		layout.activeInspectorTab = defaultTab;
	});
</script>

<aside
	data-ui="inspector"
	aria-label="Workspace inspector"
	inert={hidden || undefined}
>
	<div data-ui="inspector-header">
		<div><h2>{workspaceName}</h2></div>
		{#if onCollapse}
			<PanelToggle side="right" expanded onToggle={onCollapse} />
		{/if}
	</div>

	{#key projectPath}
		{#if tabs.length && projectPath}
			<Tabs
				variant="subtab"
				lazy
				items={tabItems}
				bind:value={
					() => layout.activeInspectorTab ?? defaultTab ?? '',
					(value) => (layout.activeInspectorTab = value)
				}
				reorderable={Boolean(onReorderTabs)}
				onReorder={onReorderTabs}
			>
				{#snippet children(value)}
					{@const tab = tabs.find((candidate) => candidate.value === value)!}
					<div data-ui="inspector-panel" data-panel={value}>
						<ExtensionViewPanel
							{store}
							projectPath={projectPath!}
							extensionId={tab.extensionId}
							viewId={tab.viewId}
							sessionId={tab.sessionId}
							tabLabel={tab.label}
							settings={layout.extensionSettings[tab.extensionId]}
							onViewChange={(view) => (views[tab.value] = view)}
						/>
					</div>
				{/snippet}
			</Tabs>
		{:else}
			<div data-ui="empty-state">
				<strong>No inspector extensions enabled</strong>
				<span>Enable an extension with an inspector tab to show it here.</span>
			</div>
		{/if}
	{/key}
</aside>
