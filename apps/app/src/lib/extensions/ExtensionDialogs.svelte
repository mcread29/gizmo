<script lang="ts">
	import { ConfirmDialog, Dialog } from '@gizmo/ui';
	import type { AgentStore } from '../agent-client';
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	import ExtensionViewPanel from './ExtensionViewPanel.svelte';
	import { extensionUi } from './extension-ui.svelte';

	let { store, layout }: { store: AgentStore; layout: WorkspaceLayout } =
		$props();

	let confirmation = $derived(store.pendingConfirmations[0]);
	// Unity's compile prompt predates the generic confirmation and still
	// arrives without copy, so its wording stays as the fallback.
	let fallback = $derived(
		confirmation?.kind === 'stop_play_mode_for_compile'
			? {
					title: 'Stop play mode to compile?',
					message:
						'The project is in play mode. Gizmo has to leave it before Unity can compile the change.',
				}
			: { title: 'Confirm', message: 'The extension is asking to continue.' },
	);
	// Preserve the saved Unity compile policy while older confirmations use
	// the shared stop-play-mode kind.
	let compilePolicy = $derived(
		confirmation?.kind === 'stop_play_mode_for_compile'
			? layout.extensionSettings.unity?.compilePlayModePolicy
			: undefined,
	);
	let automatic = $derived(
		compilePolicy === 'stop' || compilePolicy === 'keep_playing',
	);
	$effect(() => {
		if (confirmation && automatic)
			void store.resolveConfirmation(confirmation, compilePolicy === 'stop');
	});
</script>

{#each extensionUi.modalViews() as modal (`${modal.extensionId}.${modal.value.id}`)}
	{@const open =
		layout.openExtensionView === `${modal.extensionId}.${modal.value.id}`}
	{#if open && store.selectedProjectPath}
		<Dialog
			bind:open={
				() => true,
				(value) => {
					if (!value) layout.openExtensionView = undefined;
				}
			}
			title={modal.value.label}
			size="lg"
		>
			<ExtensionViewPanel
				{store}
				projectPath={store.selectedProjectPath}
				extensionId={modal.extensionId}
				viewId={modal.value.id}
				sessionId={modal.value.scope === 'thread' ? store.sessionId : undefined}
				settings={layout.extensionSettings[modal.extensionId]}
			/>
		</Dialog>
	{/if}
{/each}

{#if confirmation && !automatic}
	{@const current = confirmation}
	<ConfirmDialog
		bind:open={() => true, () => {}}
		title={current.title ?? fallback.title}
		description={current.message ?? fallback.message}
		confirmLabel="Continue"
		tone="primary"
		onConfirm={() => store.resolveConfirmation(current, true)}
		onCancel={() => store.resolveConfirmation(current, false)}
	/>
{/if}
