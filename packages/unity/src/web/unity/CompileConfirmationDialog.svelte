<script lang="ts">
	import type { PendingConfirmation, UnityHost, UnityLayout } from '../host';

	interface Props {
		store: UnityHost;
		layout: UnityLayout;
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

{#if open}
	<div role="dialog" aria-modal="true">
		<h2>Stop Play Mode to compile?</h2><p>Unity must leave Play Mode before the agent can compile scripts.</p>
		<button type="button" onclick={() => answer(true)}>Stop and compile</button>
		<button type="button" onclick={() => answer(false)}>Keep playing</button>
	</div>
{/if}
