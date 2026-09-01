<script lang="ts">
	import type { AgentAttachment, ComposerCommand } from '@gizmo/protocol';
	import { tick } from 'svelte';
	import type { AgentStore } from '../../agent-client';
	import { toasts } from '../../toasts.svelte';
	import { maxAttachmentCount, readAttachments } from './attachments';
	import { autoGrow, isSendKey, resizeComposer } from './composer-actions';
	import ComposerAttachments from './ComposerAttachments.svelte';
	import ComposerCommandMenu from './ComposerCommandMenu.svelte';
	import ComposerToolbar from './ComposerToolbar.svelte';
	import type { DraftStore } from './drafts.svelte';

	interface Props {
		store: AgentStore;
		drafts: DraftStore;
		sendOnEnter: boolean;
		focus?: () => void;
	}

	let { store, drafts, sendOnEnter, focus = $bindable() }: Props = $props();

	let element: HTMLTextAreaElement | undefined;
	let picker: HTMLInputElement | undefined;
	let dragging = $state(false);
	let selectedCommand = $state(0);
	let commandMenuDismissed = $state(false);
	let attachmentsBySession = $state<Record<string, AgentAttachment[]>>({});

	const localCommands: ComposerCommand[] = [
		{
			name: 'reload',
			description: 'Reload extension UI and activation state',
			source: 'extension',
		},
	];
	let draft = $derived(
		drafts.get(store.sessionId) ||
			(store.sessionId ? drafts.get(undefined) : ''),
	);
	let attachmentKey = $derived(store.sessionId ?? 'unassigned');
	let attachments = $derived(
		attachmentsBySession[attachmentKey] ??
			(store.sessionId ? attachmentsBySession.unassigned : undefined) ??
			[],
	);
	let commandQuery = $derived(draft.match(/^\/([^\s]*)$/)?.[1]);
	let matchingCommands = $derived.by(() => {
		if (commandQuery === undefined || commandMenuDismissed) return [];
		const query = commandQuery.toLocaleLowerCase();
		return [...localCommands, ...store.commands]
			.filter(({ name, description }) =>
				`${name} ${description ?? ''}`.toLocaleLowerCase().includes(query),
			)
			.sort((left, right) => {
				const leftStarts = left.name.toLocaleLowerCase().startsWith(query);
				const rightStarts = right.name.toLocaleLowerCase().startsWith(query);
				if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
				return left.name.localeCompare(right.name);
			})
			.slice(0, 10);
	});
	let commandMenuOpen = $derived(matchingCommands.length > 0);
	let streaming = $derived(store.sessionState === 'streaming');
	/** Why sending is unavailable, shown above the input instead of a silent grey-out. */
	let notice = $derived(
		store.compacting
			? 'Compacting context. Sending resumes when it finishes.'
			: store.connection !== 'connected'
				? 'Not connected to Gizmo. Reconnect to send messages.'
				: undefined,
	);
	let canSend = $derived(
		Boolean(draft.trim() || attachments.length) &&
			!store.compacting &&
			store.connection === 'connected' &&
			Boolean(store.sessionId),
	);

	$effect(() => {
		if (!store.sessionId) return;
		drafts.adopt(store.sessionId);
		const pending = attachmentsBySession.unassigned;
		if (pending?.length) {
			attachmentsBySession[store.sessionId] ??= pending;
			delete attachmentsBySession.unassigned;
		}
	});

	focus = () => element?.focus();

	function captureComposer(node: HTMLTextAreaElement) {
		element = node;
		return () => {
			if (element === node) element = undefined;
		};
	}

	function capturePicker(node: HTMLInputElement) {
		picker = node;
		return () => {
			if (picker === node) picker = undefined;
		};
	}

	function edit(value: string) {
		drafts.set(store.sessionId, value);
		selectedCommand = 0;
		commandMenuDismissed = false;
	}

	function selectCommand(command = matchingCommands[selectedCommand]) {
		if (!command) return;
		drafts.set(store.sessionId, `/${command.name} `);
		selectedCommand = 0;
		commandMenuDismissed = true;
		void tick().then(() => {
			resizeComposer(element);
			element?.focus();
		});
	}

	/* Streaming sends steer the run in flight rather than queueing a new turn. */
	async function send() {
		if (!canSend) return;
		const text = draft;
		const sentAttachments = [...attachments];
		drafts.clear(store.sessionId);
		delete attachmentsBySession[attachmentKey];
		void tick().then(() => resizeComposer(element));

		if (text.trim() === '/reload' && sentAttachments.length === 0) {
			const diagnostics = await store.reloadExtensions();
			if (diagnostics.length > 0) {
				console.warn(...diagnostics);
				toasts.show('Extensions reloaded with warnings', 'warning');
				return;
			}
			toasts.show('Extensions reloaded');
			return;
		}

		await (streaming
			? store.steer(text, sentAttachments)
			: store.prompt(text, sentAttachments));
		// A rejected send hands the text back rather than making the user retype it.
		if (store.error?.kind === 'prompt' && !drafts.get(store.sessionId)) {
			drafts.set(store.sessionId, text);
			attachmentsBySession[attachmentKey] = sentAttachments;
			void tick().then(() => resizeComposer(element));
		}
	}

	async function addFiles(files: Iterable<File>) {
		try {
			const added = await readAttachments(files);
			if (attachments.length + added.length > maxAttachmentCount) {
				throw new Error(`Attach at most ${maxAttachmentCount} files.`);
			}
			attachmentsBySession[attachmentKey] = [...attachments, ...added];
		} catch (error) {
			toasts.show(
				error instanceof Error ? error.message : 'Could not attach that file.',
				'danger',
			);
		}
	}

	function removeAttachment(index: number) {
		attachmentsBySession[attachmentKey] = attachments.filter(
			(_, candidate) => candidate !== index,
		);
	}

	function handlePaste(event: ClipboardEvent) {
		const files = Array.from(event.clipboardData?.files ?? []);
		if (!files.length) return;
		event.preventDefault();
		void addFiles(files);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (commandMenuOpen) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				const direction = event.key === 'ArrowDown' ? 1 : -1;
				selectedCommand =
					(selectedCommand + direction + matchingCommands.length) %
					matchingCommands.length;
				return;
			}
			if (event.key === 'Tab' || event.key === 'Enter') {
				event.preventDefault();
				selectCommand();
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				commandMenuDismissed = true;
				return;
			}
		}
		// An empty composer recalls the last prompt for quick correction.
		if (event.key === 'ArrowUp' && !draft && store.lastPrompt) {
			event.preventDefault();
			edit(store.lastPrompt);
			return;
		}
		if (!isSendKey(event, sendOnEnter)) return;
		event.preventDefault();
		void send();
	}
</script>

<form
	data-ui="composer"
	data-context-kind="composer"
	data-dragging={dragging || undefined}
	ondragenter={(event) => {
		event.preventDefault();
		dragging = true;
	}}
	ondragover={(event) => event.preventDefault()}
	ondragleave={(event) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null))
			dragging = false;
	}}
	ondrop={(event) => {
		event.preventDefault();
		dragging = false;
		if (event.dataTransfer) void addFiles(event.dataTransfer.files);
	}}
	onsubmit={(event) => {
		event.preventDefault();
		void send();
	}}
>
	<input
		{@attach capturePicker}
		data-ui="attachment-picker"
		type="file"
		multiple
		aria-label="Choose attachments"
		onchange={(event) => {
			void addFiles(event.currentTarget.files ?? []);
			event.currentTarget.value = '';
		}}
	/>
	{#if commandMenuOpen}
		<ComposerCommandMenu
			commands={matchingCommands}
			selected={selectedCommand}
			onSelect={selectCommand}
		/>
	{/if}
	<ComposerAttachments {attachments} onRemove={removeAttachment} />
	{#if notice}
		<p data-ui="composer-notice" role="status">{notice}</p>
	{/if}
	<label for="prompt" data-ui="sr-only">Message Gizmo</label>
	<textarea
		id="prompt"
		{@attach captureComposer}
		value={draft}
		oninput={(event) => edit(event.currentTarget.value)}
		onpaste={handlePaste}
		onkeydown={handleKeydown}
		{@attach autoGrow}
		aria-autocomplete="list"
		aria-controls={commandMenuOpen ? 'composer-command-menu' : undefined}
		aria-activedescendant={commandMenuOpen
			? `composer-command-${selectedCommand}`
			: undefined}
		rows="1"
		disabled={store.compacting}
		placeholder={store.compacting
			? 'Compacting context…'
			: streaming
				? 'Steer the response while it runs…'
				: 'Ask about your workspace…'}></textarea>
	<ComposerToolbar
		{store}
		attachmentCount={attachments.length}
		{streaming}
		{canSend}
		{sendOnEnter}
		onAttach={() => picker?.click()}
	/>
</form>
