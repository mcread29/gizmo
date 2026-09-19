<script lang="ts">
	import type { Action, ActionEvent } from '@gizmo/extension-api';
	import { Button, Menu, type MenuItem } from '@gizmo/ui';
	import { extensionIcon, hasExtensionIcon } from '../icons';
	import { runIntent, type ViewIntentHost } from './intents';
	import type { ActionSelection } from './item-actions';
	import ViewActionDialogs from './ViewActionDialogs.svelte';

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
		/** The path behind a row, defaulting to whatever the block has picked. */
		pathOf: (blockId: string, itemId?: string) => string | undefined;
		host: ViewIntentHost;
		onSend: (event: ActionEvent) => void;
		/**
		 * A tool result card has no open view to talk to, so only actions the
		 * host can run by itself are shown.
		 */
		readonly?: boolean;
	} = $props();

	type Pending = { action: Action; selection?: ActionSelection };

	let confirming = $state<Pending>();
	let prompting = $state<Pending>();

	/** Row actions are drawn by the blocks themselves, not by this bar. */
	let bar = $derived(
		actions.filter(
			(action) =>
				action.placement !== 'item' && (!readonly || Boolean(action.intent)),
		),
	);
	let shown = $derived(bar.filter((action) => action.group !== 'overflow'));
	let overflow = $derived(bar.filter((action) => action.group === 'overflow'));
	let menuItems = $derived<MenuItem[]>(
		overflow.map((action) => ({
			label: action.label,
			tone: action.tone === 'danger' ? 'danger' : 'default',
			disabled: disabled(action),
			onSelect: () => start(action),
		})),
	);

	function selectionFor(action: Action): ActionSelection | undefined {
		if (!action.selection) return undefined;
		const itemId = selectionOf(action.selection.blockId);
		return itemId ? { blockId: action.selection.blockId, itemId } : undefined;
	}

	function disabled(action: Action) {
		if (action.disabled) return true;
		return Boolean(action.selection?.required) && !selectionFor(action);
	}

	function variant(action: Action) {
		if (action.tone === 'primary') return 'primary' as const;
		if (action.tone === 'danger') return 'danger' as const;
		return action.group === 'secondary'
			? ('ghost' as const)
			: ('secondary' as const);
	}

	/**
	 * A quiet action with an icon earns its place as the icon alone; the
	 * label stays as the accessible name and the tooltip.
	 */
	function iconOnly(action: Action) {
		return action.group === 'secondary' && hasExtensionIcon(action.icon);
	}

	/** Runs an action, on a row when one is named and on the bar otherwise. */
	export function start(action: Action, selection?: ActionSelection): void {
		const pending = { action, selection: selection ?? selectionFor(action) };
		if (action.confirm) {
			confirming = pending;
			return;
		}
		collect(pending);
	}

	function collect(pending: Pending) {
		if (!pending.action.input) {
			finish(pending);
			return;
		}
		prompting = pending;
	}

	function finish({ action, selection }: Pending, value?: string) {
		// An intent is the host's own work; the extension is never called.
		if (action.intent) {
			runIntent(action.intent, host, (blockId) =>
				pathOf(
					blockId,
					selection?.blockId === blockId ? selection.itemId : undefined,
				),
			);
			return;
		}
		onSend({
			actionId: action.id,
			cancelled: false,
			...(selection ? { selection } : {}),
			...(value === undefined ? {} : { value }),
		});
	}

	/** The extension hears about a dismissed dialog; an intent simply does not run. */
	function cancel({ action }: Pending) {
		if (!action.intent) onSend({ actionId: action.id, cancelled: true });
	}
</script>

{#if shown.length || overflow.length}
	<div data-ui="view-actions">
		{#each shown as action (action.id)}
			{@const Icon = extensionIcon(action.icon)}
			<Button
				variant={variant(action)}
				size={iconOnly(action) ? 'icon' : 'sm'}
				disabled={disabled(action)}
				title={iconOnly(action) ? action.label : undefined}
				aria-label={iconOnly(action) ? action.label : undefined}
				onclick={() => start(action)}
			>
				{#if hasExtensionIcon(action.icon)}<Icon
						size={14}
						aria-hidden="true"
					/>{/if}
				{#if !iconOnly(action)}{action.label}{/if}
			</Button>
		{/each}
		{#if overflow.length}
			{@const More = extensionIcon('ellipsis')}
			<Menu items={menuItems}>
				{#snippet trigger(props)}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						title="More actions"
						aria-label="More actions"
						><More size={14} aria-hidden="true" /></Button
					>
				{/snippet}
			</Menu>
		{/if}
	</div>
{/if}

<ViewActionDialogs
	confirming={confirming?.action}
	prompting={prompting?.action}
	onConfirm={() => {
		const pending = confirming!;
		confirming = undefined;
		collect(pending);
	}}
	onSubmit={(value) => {
		const pending = prompting!;
		prompting = undefined;
		finish(pending, value);
	}}
	onCancel={() => {
		const pending = prompting ?? confirming!;
		confirming = undefined;
		prompting = undefined;
		cancel(pending);
	}}
/>
