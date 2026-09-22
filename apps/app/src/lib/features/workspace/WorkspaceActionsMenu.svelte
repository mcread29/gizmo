<script lang="ts">
	import { MoreHorizontal } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ConfirmDialog, Menu } from '../../components';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		onRemoved: () => void;
	}

	let { store, workspacePath, onRemoved }: Props = $props();
	let removeOpen = $state(false);
	let hidden = $derived(
		Boolean(store.projects.find(({ path }) => path === workspacePath)?.hidden),
	);

	async function removeWorkspace() {
		await store.removeProject(workspacePath);
		onRemoved();
	}
</script>

<!--
	Removal is a once-ever action, so it does not earn a tab or a card at the
	bottom of a settings page you scroll past every visit. It lives beside New
	thread as the workspace's other whole-workspace action.
-->
<Menu
	items={[
		{
			// Hiding is reversible and destroys nothing, so it asks nothing.
			label: hidden ? 'Show workspace' : 'Hide workspace',
			onSelect: () => void store.setProjectHidden(workspacePath, !hidden),
		},
		{
			label: 'Remove workspace…',
			tone: 'danger',
			onSelect: () => (removeOpen = true),
		},
	]}
>
	{#snippet trigger(props)}
		<Button
			{...props}
			variant="ghost"
			size="icon"
			aria-label="Workspace actions"><MoreHorizontal size={16} /></Button
		>
	{/snippet}
</Menu>

<ConfirmDialog
	bind:open={removeOpen}
	title="Remove this workspace?"
	description="Gizmo forgets the workspace setup and its skill overrides. Project files and existing threads are not touched."
	confirmLabel="Remove workspace"
	onConfirm={() => void removeWorkspace()}
/>
