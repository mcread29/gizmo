<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import { Tabs, applyOrder } from '../components';
	import PanelToggle from '../features/shell/PanelToggle.svelte';
	import { activateProjectExtensions, webExtensions } from './registry.svelte';
	import type { WebExtensionRuntime } from './types';
	import { workspaceNameFromPath } from './workspace-label';

	let {
		store,
		hidden,
		onCollapse,
		tabOrder = [],
		onReorderTabs,
	}: {
		store: AgentStore;
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
	let extensionRuntimes = $state<WebExtensionRuntime[]>([]);

	$effect(() => {
		const descriptors = store.projectExtensions.filter(({ id }) =>
			store.enabledExtensionIds.includes(id),
		);
		const runtimes = projectPath
			? activateProjectExtensions(descriptors, {
					projectPath,
					get sessionId() {
						return store.sessionId;
					},
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

	// Every enabled extension contributes peer tabs to the app-owned inspector.
	// Runtime tabs use the same route as static tabs; neither can own the shell.
	let tabs = $derived(
		applyOrder(
			[
				...webExtensions()
					.filter(({ id }) => store.enabledExtensionIds.includes(id))
					.flatMap(
						(definition) =>
							definition.inspectorTabs?.({
								store,
								projectPath,
								toolActivity: store.messages.flatMap(({ tools }) => tools),
							}) ?? [],
					),
				...extensionRuntimes.flatMap((runtime) => runtime.inspectorTabs),
			],
			tabOrder,
			(tab) => tab.id,
		).map((tab) => ({
			value: tab.id,
			label: tab.label,
			shortLabel: tab.shortLabel,
			badge: tab.badge,
			badgeTone: tab.badgeTone,
			component: tab.component,
			props: tab.props,
		})),
	);
	let defaultTab = $derived(tabs[0]?.value);
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
		{#if tabs.length}
			<Tabs
				variant="subtab"
				lazy
				items={tabs}
				value={defaultTab}
				reorderable={Boolean(onReorderTabs)}
				onReorder={onReorderTabs}
			>
				{#snippet children(value)}
					{@const tab = tabs.find((candidate) => candidate.value === value)!}
					{@const Panel = tab.component}
					<div data-ui="inspector-panel" data-panel={value}>
						<Panel {...tab.props} {store} {projectPath} />
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
