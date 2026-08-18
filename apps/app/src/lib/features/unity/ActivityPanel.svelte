<script lang="ts">
	import { CircleCheck, Terminal } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { toolLabel } from '../conversation/tool-labels';
	import type { UnityView } from './unity-view';

	let { view, store }: { view: UnityView; store: AgentStore } = $props();
</script>

{#if view.toolActivity.length === 0}
	<div data-ui="empty-state">
		<CircleCheck size={22} /><strong>All caught up</strong><span
			>Tool activity will appear here.</span
		>
	</div>
{:else}
	<div data-ui="activity-list">
		{#each view.toolActivity as tool (tool.id)}
			<div data-ui="activity-item" data-state={tool.status}>
				<Terminal size={14} /><span
					><strong>{tool.name}</strong><small>{tool.statusText}</small></span
				>
			</div>
		{/each}
	</div>
{/if}

{#if store.activeTools.length}
	<section data-ui="inspector-card" data-ui-spaced="true">
		<div data-ui="card-label">
			<span>Available tools</span><span>{store.activeTools.length}</span>
		</div>
		<div data-ui="tool-command-list">
			{#each store.activeTools as tool (tool)}
				<code title={tool}>{toolLabel(tool)}</code>
			{/each}
		</div>
	</section>
{/if}
