import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App.svelte';
import { FakeAgentClient } from './lib/agent-client';

const initialInnerWidth = window.innerWidth;

afterEach(() => {
	cleanup();
	Object.defineProperty(window, 'innerWidth', {
		configurable: true,
		value: initialInnerWidth,
	});
});

function renderApp() {
	return render(App, { client: new FakeAgentClient({ latencyMs: 0 }) });
}

describe('application shell', () => {
	it('renders the primary workspace regions', () => {
		const { getByRole } = renderApp();

		expect(getByRole('main')).toBeInTheDocument();
		expect(
			getByRole('navigation', { name: 'Recent threads' }),
		).toBeInTheDocument();
		expect(
			getByRole('complementary', { name: 'Unity Editor inspector' }),
		).toBeInTheDocument();
		expect(
			getByRole('textbox', { name: 'Message Unity Agent' }),
		).toBeInTheDocument();
	});

	it('collapses both docked sidebars and exposes resize handles', async () => {
		Object.defineProperty(window, 'innerWidth', {
			configurable: true,
			value: 1440,
		});
		const { findByRole, getByRole } = renderApp();

		expect(
			await findByRole('slider', { name: 'Resize thread sidebar' }),
		).toBeInTheDocument();
		expect(
			getByRole('slider', { name: 'Resize editor inspector' }),
		).toBeInTheDocument();

		const leftToggle = getByRole('button', {
			name: 'Toggle thread sidebar',
		});
		const rightToggle = getByRole('button', {
			name: 'Toggle editor inspector',
		});
		expect(leftToggle).toHaveAttribute('aria-expanded', 'true');
		expect(rightToggle).toHaveAttribute('aria-expanded', 'true');

		await fireEvent.click(leftToggle);
		await fireEvent.click(rightToggle);

		expect(leftToggle).toHaveAttribute('aria-expanded', 'false');
		expect(rightToggle).toHaveAttribute('aria-expanded', 'false');
	});

	it('grows the composer before enabling its scrollbar', async () => {
		const { getByRole } = renderApp();
		const composer = getByRole('textbox', {
			name: 'Message Unity Agent',
		}) as HTMLTextAreaElement;
		Object.defineProperty(composer, 'scrollHeight', {
			configurable: true,
			value: 120,
		});

		await fireEvent.input(composer, { target: { value: 'Several lines' } });
		expect(composer.style.height).toBe('120px');
		expect(composer.style.overflowY).toBe('hidden');

		Object.defineProperty(composer, 'scrollHeight', {
			configurable: true,
			value: 320,
		});
		await fireEvent.input(composer, {
			target: { value: 'A very tall prompt' },
		});
		expect(composer.style.height).toBe('240px');
		expect(composer.style.overflowY).toBe('auto');
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

	it('starts a thread from a workspace and exposes model controls', async () => {
		const { findByRole, findByText, getByRole } = renderApp();
		await findByRole('button', { name: 'Model' });
		expect(
			await findByRole('button', { name: 'Thinking level' }),
		).toBeInTheDocument();

		await fireEvent.click(getByRole('button', { name: 'New thread' }));
		expect(
			await findByRole('dialog', { name: 'New thread' }),
		).toBeInTheDocument();
		await fireEvent.click(getByRole('button', { name: /RenderingPlayground/ }));

		expect(await findByText(/RenderingPlayground · Now/)).toBeInTheDocument();
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
