<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import { Tabs } from '../../components';
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
</script>

<aside
	data-ui="inspector"
	data-context-kind="unity"
	data-context-value={view.projectPath}
	aria-label="Unity Editor inspector"
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

	<Tabs
		items={[
			{ value: 'editor', label: 'Editor' },
			{ value: 'activity', label: 'Activity' },
		]}
		bind:value={inspectorTab}
	>
		{#snippet children(value)}
			{#if value === 'editor'}
				<EditorPanel {view} {store} {onOpenProject} />
			{:else}
				<ActivityPanel {view} {store} />
			{/if}
		{/snippet}
	</Tabs>
</aside>
