import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PiExtensionQuestion from '../../../../src/lib/features/extension-ui/PiExtensionQuestion.svelte';
import type { PiExtensionDialog } from '../../../../src/lib/features/extension-ui/PiExtensionUiStore.svelte.ts';

function stubUi(respond: ReturnType<typeof vi.fn>) {
	return {
		responding: new Set<string>(),
		respond,
		queueCustomAnswer: vi.fn(),
	} as never;
}

function selectDialog(): PiExtensionDialog {
	return {
		type: 'extension.ui.requested',
		protocolVersion: 25,
		eventId: 1,
		sessionId: 'session-1',
		runtimeId: 'runtime-1',
		uiRequestId: 'extension-ui-1',
		request: {
			method: 'select',
			title: 'Which color do you prefer?',
			options: ['1. Red', '2. Blue', '3. Write my own answer…'],
		},
	} as PiExtensionDialog;
}

function inputDialog(): PiExtensionDialog {
	return {
		type: 'extension.ui.requested',
		protocolVersion: 25,
		eventId: 2,
		sessionId: 'session-1',
		runtimeId: 'runtime-1',
		uiRequestId: 'extension-ui-2',
		request: {
			method: 'input',
			title: 'What should we name it?',
			placeholder: 'Type your answer…',
		},
	} as PiExtensionDialog;
}

describe('PiExtensionQuestion', () => {
	it('hides the custom-answer sentinel from the option list', () => {
		const respond = vi.fn().mockResolvedValue(undefined);
		render(PiExtensionQuestion, {
			ui: stubUi(respond),
			question: selectDialog(),
		});

		expect(screen.getByRole('button', { name: '1. Red' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '2. Blue' })).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: /write my own answer/i }),
		).toBeNull();
	});

	it('answers with the picked option', async () => {
		const respond = vi.fn().mockResolvedValue(undefined);
		render(PiExtensionQuestion, {
			ui: stubUi(respond),
			question: selectDialog(),
		});

		await fireEvent.click(screen.getByRole('button', { name: '2. Blue' }));

		expect(respond).toHaveBeenCalledWith(expect.anything(), {
			kind: 'value',
			value: '2. Blue',
		});
	});

	it('submits typed text through the queued custom answer', async () => {
		const respond = vi.fn().mockResolvedValue(undefined);
		const queueCustomAnswer = vi.fn();
		const ui = {
			responding: new Set<string>(),
			respond,
			queueCustomAnswer,
		} as never;
		render(PiExtensionQuestion, { ui, question: selectDialog() });

		const input = screen.getByLabelText('Your answer');
		await fireEvent.input(input, { target: { value: 'Teal, mostly' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

		expect(queueCustomAnswer).toHaveBeenCalledWith('session-1', 'Teal, mostly');
		expect(respond).toHaveBeenCalledWith(expect.anything(), {
			kind: 'value',
			value: '3. Write my own answer…',
		});
	});

	it('submits typed text directly for input requests', async () => {
		const respond = vi.fn().mockResolvedValue(undefined);
		render(PiExtensionQuestion, {
			ui: stubUi(respond),
			question: inputDialog(),
		});

		const input = screen.getByLabelText('Your answer');
		await fireEvent.input(input, { target: { value: 'Gizmo' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

		expect(respond).toHaveBeenCalledWith(expect.anything(), {
			kind: 'value',
			value: 'Gizmo',
		});
	});

	it('can skip the question', async () => {
		const respond = vi.fn().mockResolvedValue(undefined);
		render(PiExtensionQuestion, {
			ui: stubUi(respond),
			question: selectDialog(),
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

		expect(respond).toHaveBeenCalledWith(expect.anything(), {
			kind: 'cancelled',
		});
	});
});
