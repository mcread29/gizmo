import { describe, expect, it, vi } from 'vitest';
import { PiExtensionUiStore } from './PiExtensionUiStore.svelte';

/** The exact wire shape the server emits for a bridge select request. */
const selectEvent = {
	type: 'extension.ui.requested',
	protocolVersion: 24,
	eventId: 1,
	sessionId: 'session-1',
	runtimeId: 'runtime-1',
	uiRequestId: 'extension-ui-1',
	request: {
		method: 'select',
		title: 'Which color do you prefer?',
		options: ['1. Red', '2. Blue', '3. Write my own answer…'],
	},
};

function makeStore() {
	let listener: ((event: unknown) => void) | undefined;
	const client = {
		subscribe: (l: (event: unknown) => void) => {
			listener = l;
			return () => {};
		},
		subscribeDisconnect: () => () => {},
		resolveExtensionUi: vi.fn().mockResolvedValue(undefined),
	};
	const toasts = { show: vi.fn() };
	const store = new PiExtensionUiStore(client as never, toasts as never);
	store.start();
	return { store, emit: (event: unknown) => listener?.(event), client };
}

describe('PiExtensionUiStore questions', () => {
	it('routes bridge select requests into questionsFor', () => {
		const { store, emit } = makeStore();
		emit(selectEvent);

		const questions = store.questionsFor('session-1');
		expect(questions).toHaveLength(1);
		expect(questions[0]!.request.method).toBe('select');
		// Select/input never render as modal dialogs anymore.
		expect(store.dialogFor('session-1')).toBeUndefined();
	});

	it('answers through the client and removes the question', async () => {
		const { store, emit, client } = makeStore();
		emit(selectEvent);
		const question = store.questionsFor('session-1')[0]!;

		await store.respond(question, { kind: 'value', value: '1. Red' });

		expect(client.resolveExtensionUi).toHaveBeenCalledWith(
			'session-1',
			'runtime-1',
			'extension-ui-1',
			{ kind: 'value', value: '1. Red' },
		);
		expect(store.questionsFor('session-1')).toHaveLength(0);
	});
});
