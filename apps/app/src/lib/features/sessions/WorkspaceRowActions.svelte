<script lang="ts">
	import { Plus, Settings2 } from '@lucide/svelte';
	import type { StoredProject } from '@gizmo/protocol';
	import { Button, Tooltip } from '../../components';

	let {
		project,
		connected,
		onNewThread,
		onOpenSettings,
	}: {
		project: StoredProject;
		connected: boolean;
		onNewThread: (path: string) => void;
		onOpenSettings: (path: string) => void;
	} = $props();
</script>

<div data-ui="workspace-row-actions">
	<Tooltip text={`New thread in ${project.title}`}>
		{#snippet children(props)}
			<Button
				{...props}
				variant="ghost"
				size="icon"
				aria-label={`New thread in ${project.title}`}
				disabled={!connected}
				onclick={() => onNewThread(project.path)}><Plus size={15} /></Button
			>
		{/snippet}
	</Tooltip>
	<Tooltip text={`${project.title} settings`}>
		{#snippet children(props)}
			<Button
				{...props}
				variant="ghost"
				size="icon"
				aria-label={`${project.title} settings`}
				onclick={() => onOpenSettings(project.path)}
				><Settings2 size={15} /></Button
			>
		{/snippet}
	</Tooltip>
</div>
