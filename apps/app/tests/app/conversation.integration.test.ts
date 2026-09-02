import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/App.svelte';
import { FakeAgentClient } from '../../src/lib/agent-client';
import { renderApp, setupAppIntegrationTests } from '../support/app';

setupAppIntegrationTests();

describe('conversation integration', () => {
	it('steers the run in flight instead of queueing another turn', async () => {
		const client = new FakeAgentClient({ latencyMs: 20 });
		const steer = vi.spyOn(client, 'steer');
		const { findByRole, getByRole } = render(App, { client });
		const composer = getByRole('textbox', { name: 'Message Gizmo' });

		await fireEvent.input(composer, {
			target: { value: 'Inspect the Editor' },
		});
		await waitFor(() =>
			expect(getByRole('button', { name: 'Send message' })).toBeEnabled(),
		);
		await fireEvent.click(getByRole('button', { name: 'Send message' }));

		// While streaming the same control steers, and Stop stays available.
		const steerButton = await findByRole('button', { name: 'Steer response' });
		const stopButton = getByRole('button', { name: 'Stop response' });
		// Stop discards the turn, so it must not sit in the send position: a slip
		// there used to kill the run and strand the message being steered into it.
		expect(
			document.querySelector('[data-ui="composer-send"]'),
		).toContainElement(steerButton);
		expect(
			document.querySelector('[data-ui="composer-send"]'),
		).not.toContainElement(stopButton);

		await fireEvent.input(composer, {
			target: { value: 'Use the LTS branch' },
		});
		await waitFor(() => expect(steerButton).toBeEnabled());
		await fireEvent.click(steerButton);

		await waitFor(() =>
			expect(steer).toHaveBeenCalledWith(
				expect.any(String),
				'Use the LTS branch',
			),
		);
	});

	it('attaches files from the composer and sends them with the prompt', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const prompt = vi.spyOn(client, 'prompt');
		const { findByRole, getByLabelText, getByRole } = render(App, { client });
		await findByRole('button', { name: 'Attach files' });
		const file = {
			name: 'reference.png',
			type: 'image/png',
			size: 5,
			arrayBuffer: async () => new TextEncoder().encode('image').buffer,
		} as File;

		await fireEvent.change(getByLabelText('Choose attachments'), {
			target: { files: [file] },
		});
		expect(
			await findByRole('button', { name: 'Remove reference.png' }),
		).toBeInTheDocument();
		const send = getByRole('button', { name: 'Send message' });
		await waitFor(() => expect(send).toBeEnabled());
		await fireEvent.click(send);

		await waitFor(() =>
			expect(prompt).toHaveBeenCalledWith(
				expect.any(String),
				'Please inspect the attached file.',
				expect.any(Object),
				[
					{
						name: 'reference.png',
						mimeType: 'image/png',
						data: 'aW1hZ2U=',
					},
				],
			),
		);
	});

	it('keeps a separate composer draft for each thread', async () => {
		const { container, findByRole, getByRole } = renderApp();
		const composer = getByRole('textbox', {
			name: 'Message Gizmo',
		}) as HTMLTextAreaElement;
		const newThread = await findByRole('button', {
			name: 'New thread in ThirdPersonSandbox',
		});
		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-ui="session-item"]').length,
			).toBeGreaterThan(0),
		);
		await fireEvent.input(composer, { target: { value: 'First thread note' } });

		await fireEvent.click(newThread);
		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-ui="session-item"]'),
			).toHaveLength(2),
		);

		expect(composer.value).toBe('');
	});

	it('gives a run of agent messages one header instead of one each', async () => {
		const { container, findByText, getByRole } = renderApp();
		const composer = getByRole('textbox', { name: 'Message Gizmo' });
		await fireEvent.input(composer, {
			target: { value: 'Inspect the Editor' },
		});
		await waitFor(() =>
			expect(getByRole('button', { name: 'Send message' })).toBeEnabled(),
		);
		await fireEvent.click(getByRole('button', { name: 'Send message' }));
		await findByText(
			/connected and ready for commands/,
			{},
			{ timeout: 5_000 },
		);

		// One header for the prompt and one for the whole reply, however many
		// virtual rows the reply's tool calls need.
		expect(container.querySelectorAll('[data-ui="message-meta"]')).toHaveLength(
			2,
		);
		expect(
			container.querySelectorAll('[data-ui="tool-call"]').length,
		).toBeGreaterThan(1);
	});

	it('finds messages and tool arguments within the open thread', async () => {
		const { container, findByRole, getByRole } = renderApp();
		const composer = getByRole('textbox', { name: 'Message Gizmo' });
		await fireEvent.input(composer, {
			target: { value: 'Inspect the Editor' },
		});
		await waitFor(() =>
			expect(getByRole('button', { name: 'Send message' })).toBeEnabled(),
		);
		await fireEvent.click(getByRole('button', { name: 'Send message' }));
		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-ui="tool-call"]').length,
			).toBeGreaterThan(1),
		);

		await fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
		const search = await findByRole('searchbox', {
			name: 'Search this thread',
		});

		// Matches the argument of a tool call, not just the prose, and marks the
		// individual call rather than the message that contains it.
		await fireEvent.input(search, { target: { value: 'PlayerController' } });
		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-ui="tool-call"][data-matched]'),
			).toHaveLength(1),
		);

		await fireEvent.input(search, { target: { value: 'nothing-here' } });
		await waitFor(() => expect(container.textContent).toContain('No matches'));
	});
});
