<script lang="ts">
	import { ConfirmDialog } from '../../components';
	import type { AgentStore, PendingConfirmation } from '../../agent-client';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
	}

	let { store, layout }: Props = $props();
	let open = $state(false);
	let active = $state<PendingConfirmation>();
	const handled = new Set<string>();

	$effect(() => {
		const confirmation = store.pendingConfirmations[0];
		if (
			!confirmation ||
			confirmation.confirmationId === active?.confirmationId ||
			handled.has(confirmation.confirmationId)
		)
			return;
		active = confirmation;
		if (layout.compilePlayModePolicy === 'ask') open = true;
		else void answer(layout.compilePlayModePolicy === 'stop', false);
	});

	async function answer(accepted: boolean, remember = true) {
		const confirmation = active;
		if (!confirmation) return;
		handled.add(confirmation.confirmationId);
		if (remember) {
			layout.compilePlayModePolicy = accepted ? 'stop' : 'keep_playing';
		}
		active = undefined;
		open = false;
		await store.resolveConfirmation(confirmation, accepted);
	}
</script>

<ConfirmDialog
	bind:open
	title="Stop Play Mode to compile?"
	description="Unity must leave Play Mode before the agent can compile scripts. Your choice will be remembered and can be changed in Settings."
	confirmLabel="Stop and compile"
	cancelLabel="Keep playing"
	tone="primary"
	onConfirm={() => answer(true)}
	onCancel={() => answer(false)}
/>
