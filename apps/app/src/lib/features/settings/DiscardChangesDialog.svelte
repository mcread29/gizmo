<script lang="ts">
	import { ConfirmDialog } from '../../components';
	import type { UnsavedChangesGuard } from './unsaved-changes.svelte';

	let { guard }: { guard: UnsavedChangesGuard } = $props();
</script>

<ConfirmDialog
	bind:open={() => Boolean(guard.pending), (open) => !open && guard.cancel()}
	title="Discard unsaved changes?"
	confirmLabel="Discard"
	onConfirm={() => guard.confirm()}
>
	<p>{guard.pending?.message}</p>
</ConfirmDialog>
