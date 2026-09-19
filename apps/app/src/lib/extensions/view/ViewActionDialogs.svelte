<script lang="ts">
	import type { Action } from '@gizmo/extension-api';
	import { Button, ConfirmDialog, Dialog, SelectField } from '@gizmo/ui';

	let {
		confirming,
		prompting,
		onConfirm,
		onSubmit,
		onCancel,
	}: {
		/** The action waiting on a yes, if any. */
		confirming?: Action;
		/** The action waiting on a value, if any. */
		prompting?: Action;
		onConfirm: () => void;
		onSubmit: (value: string) => void;
		onCancel: () => void;
	} = $props();

	let value = $state('');

	// A fresh prompt starts from the action's own initial value, not whatever
	// the previous prompt was left holding.
	$effect(() => {
		const input = prompting?.input;
		value = !input || input.kind === 'select' ? '' : (input.initialValue ?? '');
	});
</script>

{#if confirming}
	{@const action = confirming}
	<ConfirmDialog
		bind:open={() => true, (open) => !open && onCancel()}
		title={action.confirm?.title ?? action.label}
		description={action.confirm?.message}
		confirmLabel={action.label}
		tone={action.tone === 'danger' ? 'danger' : 'primary'}
		onConfirm={() => onConfirm()}
		onCancel={() => onCancel()}
	/>
{/if}

{#if prompting}
	{@const action = prompting}
	{@const input = action.input!}
	<!-- Dismissing the dialog is a cancelled action, not a silent no-op. -->
	<Dialog
		bind:open={() => true, (open) => !open && onCancel()}
		title={action.label}
		description={input.label}
	>
		<div data-ui="view-input">
			{#if input.kind === 'select'}
				<SelectField bind:value label={input.label} options={input.options} />
			{:else if input.kind === 'multiline'}
				<textarea
					aria-label={input.label}
					placeholder={input.placeholder}
					bind:value
					rows="5"></textarea>
			{:else}
				<input
					type="text"
					aria-label={input.label}
					placeholder={input.placeholder}
					bind:value
				/>
			{/if}
			<div data-ui="dialog-actions">
				<Button variant="secondary" onclick={() => onCancel()}>Cancel</Button>
				<Button
					variant="primary"
					disabled={Boolean(input.required) && !value}
					onclick={() => onSubmit(value)}>{action.label}</Button
				>
			</div>
		</div>
	</Dialog>
{/if}

<style>
	[data-ui='view-input'] {
		display: grid;
		gap: var(--space-3);
	}
	textarea,
	input {
		width: 100%;
	}
</style>
