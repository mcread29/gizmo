<script lang="ts">
	import { Button } from '@gizmo/ui';
	import type {
		PiExtensionDialog,
		PiExtensionUiStore,
	} from './PiExtensionUiStore.svelte';

	let {
		ui,
		question,
	}: {
		ui: PiExtensionUiStore;
		question: PiExtensionDialog;
	} = $props();

	let submitted = false;
	let request = $derived(question.request);
	let busy = $derived(ui.responding.has(question.uiRequestId));
	const openedAt = Date.now();
	let timeoutMs = $derived(
		'timeout' in question.request ? question.request.timeout : undefined,
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

	$effect(() => () => clearInterval(countdown));

	async function respond(
		response: { kind: 'value'; value: string } | { kind: 'cancelled' },
	) {
		if (submitted) return;
		submitted = true;
		try {
			await ui.respond(question, response);
		} catch {
			submitted = false;
		}
	}
</script>

<div data-ui="agent-question" aria-label={request.title}>
	<div data-ui="agent-question-head">
		<span data-ui="agent-question-origin">The agent is asking</span>
		{#if secondsLeft > 0}
			<span data-ui="agent-question-timeout">Closes in {secondsLeft}s</span>
		{/if}
	</div>
	<p data-ui="agent-question-text">{request.title}</p>

	{#if request.method === 'select'}
		<div data-ui="agent-question-options">
			{#each request.options as option, index (`${index}:${option}`)}
				<Button
					variant="secondary"
					size="sm"
					disabled={busy}
					onclick={() => void respond({ kind: 'value', value: option })}
					>{option}</Button
				>
			{/each}
		</div>
	{:else}
		<form
			data-ui="agent-question-form"
			onsubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				void respond({ kind: 'value', value: String(data.get('value') ?? '') });
			}}
		>
			<input
				name="value"
				placeholder={request.method === 'input'
					? (request.placeholder ?? 'Type your answer…')
					: undefined}
				disabled={busy}
				aria-label="Your answer"
			/>
			<Button type="submit" size="sm" disabled={busy}>Answer</Button>
		</form>
	{/if}

	<Button
		variant="ghost"
		size="sm"
		disabled={busy}
		onclick={() => void respond({ kind: 'cancelled' })}>Skip</Button
	>
</div>
