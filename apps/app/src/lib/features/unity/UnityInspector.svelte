<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import { Tabs } from '../../components';
	import { activateProjectExtensions } from '../../extensions/registry';
	import type { WebExtensionRuntime } from '../../extensions/types';
	import ChangesPanel from '../changes/ChangesPanel.svelte';
	import ActivityPanel from './ActivityPanel.svelte';
	import EditorPanel from './EditorPanel.svelte';
	import type { UnityView } from './unity-view';

	interface Props {
		store: AgentStore;
		view: UnityView;
		hidden: boolean;
		onOpenProject: () => void;
	}

	let { store, view, hidden, onOpenProject }: Props = $props();
	let inspectorTab = $state('editor');
	let changeCount = $derived(store.gitStatus?.files.length ?? 0);
	let extensionRuntimes = $state<WebExtensionRuntime[]>([]);
	let extensionTabs = $derived(
		extensionRuntimes.flatMap((runtime) => runtime.inspectorTabs),
	);

	$effect(() => {
		const projectPath = view.projectPath;
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

	let tabs = $derived([
		{ value: 'editor', label: 'Editor', shortLabel: 'Status' },
		{
			value: 'changes',
			label: 'Changes',
			shortLabel: 'Files',
			badge: changeCount,
		},
		...extensionTabs.map((tab) => ({
			value: tab.id,
			label: tab.label,
			shortLabel: tab.shortLabel,
			badge: tab.badge,
			badgeTone: tab.badgeTone,
		})),
		{ value: 'activity', label: 'Activity', shortLabel: 'Runs' },
	]);

	$effect(() => {
		if (tabs.some((tab) => tab.value === inspectorTab)) return;
		inspectorTab = 'editor';
	});
</script>

<aside
	data-ui="inspector"
	data-context-kind="unity"
	data-context-value={view.projectPath}
	aria-label="Workspace inspector"
	inert={hidden || undefined}
>
	<div data-ui="inspector-header">
		<div>
			<span data-ui="eyebrow">Unity Editor</span>
			<h2>{view.projectName}</h2>
		</div>
		<span data-ui="status-pill" data-state={view.lifecycle.state}
			><span></span>{view.lifecycle.label}</span
		>
	</div>

	<Tabs variant="inspector" lazy items={tabs} bind:value={inspectorTab}>
		{#snippet children(value)}
			{@const extensionTab = extensionTabs.find((tab) => tab.id === value)}
			<div
				data-ui="inspector-panel"
				data-panel={value}
				data-extension={extensionTab ? '' : undefined}
			>
				{#if value === 'editor'}
					<EditorPanel {view} {store} {onOpenProject} />
				{:else if value === 'changes'}
					<ChangesPanel {store} projectPath={view.projectPath} />
				{:else if extensionTab}
					{@const Component = extensionTab.component}
					<Component {...extensionTab.props} />
				{:else}
					<ActivityPanel {view} />
				{/if}
			</div>
		{/snippet}
	</Tabs>
</aside>
