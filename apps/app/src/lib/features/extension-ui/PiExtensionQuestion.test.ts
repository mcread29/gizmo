import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PiExtensionQuestion from './PiExtensionQuestion.svelte';
import type { PiExtensionDialog } from './PiExtensionUiStore.svelte';

function stubUi(respond: ReturnType<typeof vi.fn>) {
	return {
		responding: new Set<string>(),
		respond,
	} as never;
}

function selectDialog(): PiExtensionDialog {
	return {
		type: 'extension.ui.requested',
		protocolVersion: 24,
		eventId: 1,
		sessionId: 'session-1',
		runtimeId: 'runtime-1',
		uiRequestId: 'extension-ui-1',
		request: {
			method: 'select',
			title: 'Which database should we use?',
			options: ['Postgres', 'SQLite'],
		},
	} as PiExtensionDialog;
}

function inputDialog(): PiExtensionDialog {
	return {
		type: 'extension.ui.requested',
		protocolVersion: 24,
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
	it('renders the question and answers with the picked option', async () => {
		const respond = vi.fn().mockResolvedValue(undefined);
		render(PiExtensionQuestion, {
			ui: stubUi(respond),
			question: selectDialog(),
		});

		expect(
			screen.getByText('Which database should we use?'),
		).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'SQLite' }));

		expect(respond).toHaveBeenCalledWith(expect.anything(), {
			kind: 'value',
			value: 'SQLite',
		});
	});

	it('submits a typed answer for input requests', async () => {
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
