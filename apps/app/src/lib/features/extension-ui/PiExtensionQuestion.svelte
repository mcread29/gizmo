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

	let submitted = $state(false);
	let error = $state<string>();
	let inputEl: HTMLInputElement | undefined = $state();
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

	/**
	 * Extensions that ask multiple-choice questions may offer a custom-answer
	 * escape hatch; it is an implementation detail of the tool and is hidden
	 * from the option list, with the text input taking its place.
	 */
	const customAnswerPattern = /write my own answer/i;
	let options = $derived(
		request.method === 'select'
			? request.options.filter((option) => !customAnswerPattern.test(option))
			: [],
	);
	let acceptsText = $derived(
		request.method === 'select'
			? request.options.some((option) => customAnswerPattern.test(option))
			: request.method === 'input',
	);

	$effect(() => {
		inputEl?.focus();
	});

	async function respond(
		response: { kind: 'value'; value: string } | { kind: 'cancelled' },
	) {
		if (submitted) return;
		submitted = true;
		error = undefined;
		try {
			await ui.respond(question, response);
		} catch (cause) {
			submitted = false;
			error =
				cause instanceof Error && cause.message
					? cause.message
					: 'Could not send your answer. Try again.';
		}
	}

	function submitText(text: string) {
		if (request.method === 'input') {
			void respond({ kind: 'value', value: text });
			return;
		}
		if (request.method !== 'select') return;
		const sentinel = request.options.find((option) =>
			customAnswerPattern.test(option),
		);
		if (!sentinel) return;
		ui.queueCustomAnswer(question.sessionId, text);
		void respond({ kind: 'value', value: sentinel });
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
	{#if error}
		<p data-ui="agent-question-error" role="alert">{error}</p>
	{/if}

	{#if request.method === 'select'}
		<div data-ui="agent-question-options">
			{#each options as option, index (`${index}:${option}`)}
				<Button
					variant="secondary"
					disabled={busy}
					onclick={() => void respond({ kind: 'value', value: option })}
					>{option}</Button
				>
			{/each}
		</div>
	{/if}

	<div data-ui="agent-question-input">
		<form
			onsubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				const text = String(data.get('value') ?? '').trim();
				if (!text) return;
				submitText(text);
			}}
		>
			{#if acceptsText}
				<input
					bind:this={inputEl}
					name="value"
					placeholder={request.method === 'input' && request.placeholder
						? request.placeholder
						: 'Write your own answer…'}
					disabled={busy}
					aria-label="Your answer"
				/>
				<Button type="submit" variant="primary" disabled={busy}>Answer</Button>
			{/if}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				disabled={busy}
				onclick={() => void respond({ kind: 'cancelled' })}>Skip</Button
			>
		</form>
	</div>
</div>
