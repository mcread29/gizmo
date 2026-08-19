<script lang="ts">
	import { CircleCheck, CircleDashed, CircleX, Terminal } from '@lucide/svelte';
	import { toolLabel } from '../conversation/tool-labels';
	import { toolSummary } from '../conversation/tool-summary';
	import type { UnityView } from './unity-view';

	let { view }: { view: UnityView } = $props();
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
				<Terminal size={13} />
				<span>
					<strong>{toolLabel(tool.name)}</strong>
					<small title={toolSummary(tool.input) ?? tool.statusText}
						>{toolSummary(tool.input) ?? tool.statusText}</small
					>
				</span>
				{#if tool.status === 'running'}
					<CircleDashed data-ui="spinner" size={13} />
				{:else if tool.status === 'error'}
					<CircleX size={13} />
				{:else}
					<CircleCheck size={13} />
				{/if}
			</div>
		{/each}
	</div>
{/if}
