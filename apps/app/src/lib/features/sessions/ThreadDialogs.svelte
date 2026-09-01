<script lang="ts">
	import { Button, ConfirmDialog, Dialog } from '../../components';
	import type { SessionActions } from './session-actions.svelte';

	let { sessions }: { sessions: SessionActions } = $props();
</script>

<Dialog
	bind:open={sessions.renameOpen}
	title="Rename thread"
	description="Choose a name for this local thread"
>
	{#snippet trigger(props)}
		<button {...props} data-ui="hidden-trigger" hidden tabindex="-1"
			>Rename thread</button
		>
	{/snippet}
	<form
		data-ui="dialog-form"
		onsubmit={(event) => {
			event.preventDefault();
			void sessions.confirmRename();
		}}
	>
		<label for="session-title">Thread name</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			id="session-title"
			bind:value={sessions.renameDraft}
			autocomplete="off"
			autofocus
		/>
		<div data-ui="dialog-actions">
			<Button
				variant="secondary"
				type="button"
				onclick={() => (sessions.renameOpen = false)}>Cancel</Button
			>
			<Button
				type="submit"
				variant="primary"
				disabled={!sessions.renameDraft.trim()}>Rename</Button
			>
		</div>
	</form>
</Dialog>

<ConfirmDialog
	bind:open={sessions.deleteOpen}
	title="Delete thread?"
	confirmLabel="Delete thread"
	onConfirm={() => sessions.confirmDelete()}
>
	<p>
		<strong>{sessions.targetTitle}</strong> and its
		{sessions.targetMessageCount}
		{sessions.targetMessageCount === 1 ? 'message' : 'messages'} are removed permanently.
		This cannot be undone. Your skills, workspaces, and other threads are not affected.
	</p>
</ConfirmDialog>
