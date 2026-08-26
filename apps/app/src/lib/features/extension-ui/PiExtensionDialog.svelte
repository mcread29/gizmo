<script lang="ts">
	import { Button, Dialog } from '@gizmo/ui';
	import { onDestroy } from 'svelte';
	import type {
		PiExtensionDialog,
		PiExtensionUiStore,
	} from './PiExtensionUiStore.svelte';

	let {
		ui,
		dialog,
	}: {
		ui: PiExtensionUiStore;
		dialog: PiExtensionDialog;
	} = $props();

	let open = $state(true);
	let submitted = false;
	let request = $derived(dialog.request);
	let busy = $derived(ui.responding.has(dialog.uiRequestId));
	const openedAt = Date.now();
	let timeoutMs = $derived(
		'timeout' in dialog.request ? dialog.request.timeout : undefined,
	);
	let expiresAt = $derived(timeoutMs ? openedAt + timeoutMs : undefined);
	let secondsLeft = $state(0);
	function updateCountdown() {
		secondsLeft = expiresAt
			? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1_000))
			: 0;
	}
	updateCountdown();
	const countdown = setInterval(updateCountdown, 250);
	onDestroy(() => clearInterval(countdown));

	$effect(() => {
		if (!open && !submitted) void respond({ kind: 'cancelled' });
	});

	function moveSelection(event: KeyboardEvent) {
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		const buttons = [
			...((event.currentTarget as HTMLElement)
				.closest('[data-ui="extension-select-list"]')
				?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
		];
		const current = buttons.indexOf(event.currentTarget as HTMLButtonElement);
		if (current < 0 || buttons.length === 0) return;
		event.preventDefault();
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? buttons.length - 1
					: (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
						buttons.length;
		buttons[next]?.focus();
	}

	async function respond(
		response:
			| { kind: 'value'; value: string }
			| { kind: 'confirmed'; confirmed: boolean }
			| { kind: 'cancelled' },
	) {
		if (submitted) return;
		submitted = true;
		try {
			await ui.respond(dialog, response);
		} catch {
			submitted = false;
		}
	}
</script>

<Dialog
	bind:open
	title={request.title}
	description={request.method === 'confirm' ? request.message : undefined}
>
	{#if secondsLeft > 0}
		<p data-ui="extension-dialog-timeout">Closes in {secondsLeft}s</p>
	{/if}
	{#if request.method === 'select'}
		<div
			data-ui="extension-select-list"
			role="listbox"
			aria-label={request.title}
		>
			{#each request.options as option, index (`${index}:${option}`)}
				<button
					type="button"
					role="option"
					aria-selected="false"
					disabled={busy}
					onkeydown={moveSelection}
					onclick={() => void respond({ kind: 'value', value: option })}
				>
					{option}
				</button>
			{/each}
		</div>
		<div data-ui="dialog-actions">
			<Button variant="secondary" disabled={busy} onclick={() => (open = false)}
				>Cancel</Button
			>
		</div>
	{:else if request.method === 'confirm'}
		<div data-ui="dialog-actions">
			<Button
				variant="secondary"
				disabled={busy}
				onclick={() => void respond({ kind: 'confirmed', confirmed: false })}
				>No</Button
			>
			<Button
				variant="primary"
				disabled={busy}
				onclick={() => void respond({ kind: 'confirmed', confirmed: true })}
				>Yes</Button
			>
		</div>
	{:else}
		<form
			data-ui="extension-text-dialog"
			onsubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				void respond({ kind: 'value', value: String(data.get('value') ?? '') });
			}}
		>
			<label for={`extension-ui-${dialog.uiRequestId}`}>Response</label>
			{#if request.method === 'editor'}
				<textarea
					id={`extension-ui-${dialog.uiRequestId}`}
					name="value"
					rows="10"
					disabled={busy}>{request.prefill ?? ''}</textarea
				>
			{:else}
				<input
					id={`extension-ui-${dialog.uiRequestId}`}
					name="value"
					placeholder={request.placeholder}
					disabled={busy}
				/>
			{/if}
			<div data-ui="dialog-actions">
				<Button
					type="button"
					variant="secondary"
					disabled={busy}
					onclick={() => (open = false)}>Cancel</Button
				>
				<Button type="submit" disabled={busy}>Continue</Button>
			</div>
		</form>
	{/if}
</Dialog>
