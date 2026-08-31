<script lang="ts">
	import type { AgentStore } from '../../../agent-client';
	import { Button, ConfirmDialog } from '../../../components';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		onRemoved: () => void;
	}

	let { store, workspacePath, onRemoved }: Props = $props();
	let removeOpen = $state(false);

	async function removeWorkspace() {
		await store.removeProject(workspacePath);
		onRemoved();
	}
</script>

<div data-ui="settings-card">
	<div data-ui="setting-field">
		<div>
			<strong>Remove workspace from Gizmo</strong>
			<span>
				Gizmo forgets its setup and skill overrides. Project files and existing
				threads are untouched.
			</span>
		</div>
		<Button variant="danger" size="sm" onclick={() => (removeOpen = true)}
			>Remove</Button
		>
	</div>
</div>

<ConfirmDialog
	bind:open={removeOpen}
	title="Remove this workspace?"
	description="Gizmo forgets the workspace setup and its skill overrides. Project files and existing threads are not touched."
	confirmLabel="Remove workspace"
	onConfirm={() => void removeWorkspace()}
/>
