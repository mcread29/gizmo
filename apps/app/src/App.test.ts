import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App.svelte';
import { FakeAgentClient } from './lib/agent-client';

afterEach(cleanup);

function renderApp() {
	return render(App, { client: new FakeAgentClient({ latencyMs: 0 }) });
}

describe('application shell', () => {
	it('renders the primary workspace regions', () => {
		const { getByRole } = renderApp();

		expect(getByRole('main')).toBeInTheDocument();
		expect(
			getByRole('navigation', { name: 'Recent sessions' }),
		).toBeInTheDocument();
		expect(
			getByRole('complementary', { name: 'Unity Editor inspector' }),
		).toBeInTheDocument();
		expect(
			getByRole('textbox', { name: 'Message Unity Agent' }),
		).toBeInTheDocument();
	});

	it('has no detectable accessibility violations', async () => {
		const { container } = renderApp();
		const results = await axe(container, {
			rules: { 'color-contrast': { enabled: false } },
		});

		expect(results.violations).toEqual([]);
	});

	it('exposes every design-system primitive in the component gallery', async () => {
		const { findByRole, getByRole, getByText } = renderApp();

		await fireEvent.click(getByRole('button', { name: /components/i }));
		expect(
			await findByRole('dialog', { name: 'Interface components' }),
		).toBeInTheDocument();
		expect(getByText('Buttons')).toBeInTheDocument();
		expect(getByText('Menus and selection')).toBeInTheDocument();
		expect(getByText('Tabs and scrolling')).toBeInTheDocument();
		expect(getByText('Feedback')).toBeInTheDocument();
	});

	it('opens the selected project Editor from a disconnected state', async () => {
		const { findByRole, queryByRole } = render(App, {
			client: new FakeAgentClient({ latencyMs: 0, editorOpen: false }),
		});
		const openEditor = await findByRole('button', { name: 'Open Editor' });

		await fireEvent.click(openEditor);

		await waitFor(() =>
			expect(
				queryByRole('button', { name: 'Open Editor' }),
			).not.toBeInTheDocument(),
		);
	});

	it('shows the model and local auth boundary reported by Pi', async () => {
		const { findByText, getByRole } = renderApp();
		await fireEvent.click(getByRole('button', { name: 'Settings' }));

		expect(await findByText('gpt-5.6-sol')).toBeInTheDocument();
		expect(await findByText('Managed by Pi')).toBeInTheDocument();
		expect(await findByText('Full access')).toBeInTheDocument();
		expect(await findByText('Disabled')).toBeInTheDocument();
		expect(await findByText(/unity_command/)).toBeInTheDocument();
	});

	it('streams a fake agent response through the production UI state', async () => {
		const { findAllByText, findByText, getByRole, queryByRole } = renderApp();
		const composer = getByRole('textbox', { name: 'Message Unity Agent' });
		const send = getByRole('button', { name: 'Send message' });
		await fireEvent.input(composer, {
			target: { value: 'Inspect the Editor' },
		});
		await waitFor(() => expect(send).toBeEnabled());
		await fireEvent.click(send);

		expect((await findAllByText('Inspect the Editor')).length).toBeGreaterThan(
			0,
		);
		expect(await findByText('Unity Editor status')).toBeInTheDocument();
		expect(
			await findByText(/connected and ready for commands/),
		).toBeInTheDocument();
		expect(
			(await findAllByText('/projects/ThirdPersonSandbox')).length,
		).toBeGreaterThan(0);
		expect((await findAllByText('scene.validate')).length).toBeGreaterThan(0);
		await waitFor(() =>
			expect(
				queryByRole('button', { name: 'Stop response' }),
			).not.toBeInTheDocument(),
		);
	});
});
