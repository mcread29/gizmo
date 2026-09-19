<script lang="ts">
	import type { Action, ActionEvent } from '@gizmo/extension-api';
	import { Button, ConfirmDialog, Dialog, SelectField } from '@gizmo/ui';
	import { runIntent, type ViewIntentHost } from './intents';

	let {
		actions,
		selectionOf,
		pathOf,
		host,
		onSend,
		readonly = false,
	}: {
		actions: readonly Action[];
		selectionOf: (blockId: string) => string | undefined;
		/** The path of whatever is picked in a block, for `selection` intents. */
		pathOf: (blockId: string) => string | undefined;
		host: ViewIntentHost;
		onSend: (event: ActionEvent) => void;
		/**
		 * A tool result card has no open view to talk to, so only actions the
		 * host can run by itself are shown.
		 */
		readonly?: boolean;
	} = $props();

	let confirming = $state<Action>();
	let prompting = $state<Action>();
	let inputValue = $state('');

	let shown = $derived(actions.filter((action) => !readonly || action.intent));

	function selectionFor(action: Action) {
		if (!action.selection) return undefined;
		const itemId = selectionOf(action.selection.blockId);
		return itemId ? { blockId: action.selection.blockId, itemId } : undefined;
	}

	function disabled(action: Action) {
		if (action.disabled) return true;
		return Boolean(action.selection?.required) && !selectionFor(action);
	}

	function start(action: Action) {
		if (action.confirm) {
			confirming = action;
			return;
		}
		collect(action);
	}

	function collect(action: Action) {
		if (!action.input) {
			finish(action);
			return;
		}
		inputValue =
			action.input.kind === 'select' ? '' : (action.input.initialValue ?? '');
		prompting = action;
	}

	function finish(action: Action, value?: string) {
		const event: ActionEvent = {
			actionId: action.id,
			cancelled: false,
			...(selectionFor(action) ? { selection: selectionFor(action) } : {}),
			...(value === undefined ? {} : { value }),
		};
		// An intent is the host's own work; the extension is never called.
		if (action.intent) {
			runIntent(action.intent, host, pathOf);
			return;
		}
		onSend(event);
	}

	/** The extension hears about a dismissed dialog; an intent simply does not run. */
	function cancel(action: Action) {
		if (action.intent) return;
		onSend({ actionId: action.id, cancelled: true });
	}
</script>

{#if shown.length}
	<div data-ui="view-actions">
		{#each shown as action (action.id)}
			<Button
				variant={action.tone === 'primary'
					? 'primary'
					: action.tone === 'danger'
						? 'danger'
						: 'secondary'}
				size="sm"
				disabled={disabled(action)}
				onclick={() => start(action)}>{action.label}</Button
			>
		{/each}
	</div>
{/if}

{#if confirming}
	{@const action = confirming}
	<ConfirmDialog
		bind:open={
			() => true,
			(value) => {
				if (!value) confirming = undefined;
			}
		}
		title={action.confirm?.title ?? action.label}
		description={action.confirm?.message}
		confirmLabel={action.label}
		tone={action.tone === 'danger' ? 'danger' : 'primary'}
		onConfirm={() => {
			confirming = undefined;
			collect(action);
		}}
		onCancel={() => {
			confirming = undefined;
			cancel(action);
		}}
	/>
{/if}

{#if prompting}
	{@const action = prompting}
	{@const input = action.input!}
	<!-- Dismissing the dialog is a cancelled action, not a silent no-op. -->
	<Dialog
		bind:open={
			() => true,
			(value) => {
				if (value) return;
				prompting = undefined;
				cancel(action);
			}
		}
		title={action.label}
		description={input.label}
	>
		<div data-ui="view-input">
			{#if input.kind === 'select'}
				<SelectField
					bind:value={inputValue}
					label={input.label}
					options={input.options}
				/>
			{:else if input.kind === 'multiline'}
				<textarea
					aria-label={input.label}
					placeholder={input.placeholder}
					bind:value={inputValue}
					rows="5"
				></textarea>
			{:else}
				<input
					type="text"
					aria-label={input.label}
					placeholder={input.placeholder}
					bind:value={inputValue}
				/>
			{/if}
			<div data-ui="dialog-actions">
				<Button
					variant="secondary"
					onclick={() => {
						prompting = undefined;
						cancel(action);
					}}>Cancel</Button
				>
				<Button
					variant="primary"
					disabled={Boolean(input.required) && !inputValue}
					onclick={() => {
						prompting = undefined;
						finish(action, inputValue);
					}}>{action.label}</Button
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
