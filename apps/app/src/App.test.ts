import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import { FakeAgentClient } from './lib/agent-client';

const initialInnerWidth = window.innerWidth;

beforeEach(() => localStorage.clear());

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

	it('opens app actions from the global context menu', async () => {
		const { container, findByRole, getByRole } = renderApp();
		const shell = container.querySelector('[data-ui="app-shell"]');
		expect(shell).not.toBeNull();

		await fireEvent.contextMenu(shell!, { clientX: 300, clientY: 240 });
		expect(
			await findByRole('menuitem', { name: 'New thread' }),
		).toBeInTheDocument();
		await fireEvent.click(getByRole('menuitem', { name: 'Hide threads' }));

		expect(
			getByRole('button', { name: 'Toggle thread sidebar' }),
		).toHaveAttribute('aria-expanded', 'false');
	});

	it('applies thread context actions to the right-clicked thread', async () => {
		const { container, findByRole, getByRole } = renderApp();
		await findByRole('button', { name: 'New thread' });
		await fireEvent.click(getByRole('button', { name: 'New thread' }));
		await fireEvent.click(
			await findByRole('button', { name: /RenderingPlayground/ }),
		);

		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-ui="session-item"]'),
			).toHaveLength(2),
		);
		const active = container.querySelector<HTMLElement>(
			'[data-ui="session-item"][data-active="true"]',
		)!;
		const target = [
			...container.querySelectorAll<HTMLElement>('[data-ui="session-item"]'),
		].find((item) => item !== active)!;
		const activeId = active.dataset.contextId;
		const targetId = target.dataset.contextId;

		await fireEvent.contextMenu(target, { clientX: 180, clientY: 220 });
		expect(
			await findByRole('menuitem', { name: 'Open thread' }),
		).toBeInTheDocument();
		await fireEvent.click(getByRole('menuitem', { name: 'Delete thread' }));
		await fireEvent.click(
			await findByRole('button', { name: 'Delete thread' }),
		);

		await waitFor(() => {
			expect(
				container.querySelector(`[data-context-id="${targetId}"]`),
			).not.toBeInTheDocument();
			expect(
				container.querySelector(
					`[data-context-id="${activeId}"][data-active="true"]`,
				),
			).toBeInTheDocument();
		});
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

	it('applies and persists app settings', async () => {
		const { findByRole, getByRole, getByText } = renderApp();
		await fireEvent.click(getByRole('button', { name: 'Settings' }));

		expect(
			await findByRole('region', { name: 'Settings' }),
		).toBeInTheDocument();
		const sendOnEnter = getByRole('switch', { name: 'Send with Enter' });
		const showInspector = getByRole('switch', { name: 'Unity inspector' });
		const scheme = getByRole('button', { name: 'Color scheme' });
		expect(scheme).toHaveTextContent('Default');

		const expandReasoning = getByRole('switch', { name: 'Expand reasoning' });

		await fireEvent.click(getByRole('switch', { name: 'Dark appearance' }));
		await fireEvent.click(sendOnEnter);
		await fireEvent.click(showInspector);
		await fireEvent.click(expandReasoning);

		expect(document.documentElement).toHaveAttribute('data-theme', 'light');
		expect(getByText('⌘/Ctrl Enter')).toBeInTheDocument();
		expect(
			getByRole('button', { name: 'Toggle editor inspector' }),
		).toHaveAttribute('aria-expanded', 'false');
		await waitFor(() => {
			const saved = JSON.parse(
				localStorage.getItem('unity-agent.settings.v1') ?? '{}',
			);
			expect(saved.sendOnEnter).toBe(false);
			expect(saved.showUnityInspector).toBe(false);
			expect(saved.expandReasoning).toBe(true);
			expect(saved.theme).toBe('light');
		});

		await fireEvent.click(getByRole('button', { name: 'Restore defaults' }));
		expect(sendOnEnter).toHaveAttribute('aria-checked', 'true');
		expect(showInspector).toHaveAttribute('aria-checked', 'true');
		expect(expandReasoning).toHaveAttribute('aria-checked', 'false');
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

	it('filters threads by title from the sidebar search', async () => {
		const { container, findByRole, getByRole } = renderApp();
		await findByRole('button', { name: 'New thread' });
		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-ui="session-item"]').length,
			).toBeGreaterThan(0),
		);

		await fireEvent.input(getByRole('searchbox', { name: 'Search threads' }), {
			target: { value: 'nothing-matches-this' },
		});

		expect(container.querySelectorAll('[data-ui="session-item"]')).toHaveLength(
			0,
		);
		expect(
			getByRole('navigation', { name: 'Recent threads' }),
		).toHaveTextContent('No threads match');
	});

	it('confirms thread deletion with a cancel path and reports the result', async () => {
		const { container, findByRole, getByRole, queryByRole } = renderApp();
		await findByRole('button', { name: 'New thread' });
		await fireEvent.click(getByRole('button', { name: 'New thread' }));
		await fireEvent.click(
			await findByRole('button', { name: /RenderingPlayground/ }),
		);
		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-ui="session-item"]'),
			).toHaveLength(2),
		);

		await fireEvent.click(getByRole('button', { name: 'Thread actions' }));
		await fireEvent.click(await findByRole('menuitem', { name: 'Delete' }));
		await fireEvent.click(await findByRole('button', { name: 'Cancel' }));

		await waitFor(() =>
			expect(queryByRole('dialog', { name: 'Delete thread?' })).toBeNull(),
		);
		expect(container.querySelectorAll('[data-ui="session-item"]')).toHaveLength(
			2,
		);

		await fireEvent.click(getByRole('button', { name: 'Thread actions' }));
		await fireEvent.click(await findByRole('menuitem', { name: 'Delete' }));
		await fireEvent.click(
			await findByRole('button', { name: 'Delete thread' }),
		);

		expect(await findByRole('status')).toHaveTextContent('Deleted');
	});

	it('offers a manual retry once the agent connection drops', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const { findByRole, getByText, queryByRole } = render(App, { client });
		await findByRole('button', { name: 'New thread' });
		expect(queryByRole('button', { name: 'Retry' })).toBeNull();

		client.dropConnection();

		expect(await findByRole('button', { name: 'Retry' })).toBeInTheDocument();
		expect(getByText('Local agent offline')).toBeInTheDocument();
	});

	it('steers the run in flight instead of queueing another turn', async () => {
		const client = new FakeAgentClient({ latencyMs: 20 });
		const steer = vi.spyOn(client, 'steer');
		const { findByRole, getByRole } = render(App, { client });
		const composer = getByRole('textbox', { name: 'Message Unity Agent' });

		await fireEvent.input(composer, {
			target: { value: 'Inspect the Editor' },
		});
		await waitFor(() =>
			expect(getByRole('button', { name: 'Send message' })).toBeEnabled(),
		);
		await fireEvent.click(getByRole('button', { name: 'Send message' }));

		// While streaming the same control steers, and Stop stays available.
		const steerButton = await findByRole('button', { name: 'Steer response' });
		expect(getByRole('button', { name: 'Stop response' })).toBeInTheDocument();

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

	it('collects the files the agent edited into the Changes tab', async () => {
		const { findByRole, getByRole } = renderApp();
		const composer = getByRole('textbox', { name: 'Message Unity Agent' });
		await fireEvent.input(composer, {
			target: { value: 'Speed the player up' },
		});
		await waitFor(() =>
			expect(getByRole('button', { name: 'Send message' })).toBeEnabled(),
		);
		await fireEvent.click(getByRole('button', { name: 'Send message' }));

		const changesTab = await findByRole('tab', { name: /Changes/ });
		await waitFor(() =>
			expect(
				changesTab.querySelector('[data-ui="tabs-badge"]'),
			).toHaveTextContent('1'),
		);
		await fireEvent.click(changesTab);

		expect(
			await findByRole('button', { name: /PlayerController\.cs/ }),
		).toBeInTheDocument();
	});

	it('keeps a separate composer draft for each thread', async () => {
		const { container, findByRole, getByRole } = renderApp();
		const composer = getByRole('textbox', {
			name: 'Message Unity Agent',
		}) as HTMLTextAreaElement;
		await findByRole('button', { name: 'New thread' });
		await fireEvent.input(composer, { target: { value: 'First thread note' } });

		await fireEvent.click(getByRole('button', { name: 'New thread' }));
		await fireEvent.click(
			await findByRole('button', { name: /RenderingPlayground/ }),
		);
		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-ui="session-item"]'),
			).toHaveLength(2),
		);

		expect(composer.value).toBe('');
	});

	it('gives a run of agent messages one header instead of one each', async () => {
		const { container, findByText, getByRole } = renderApp();
		const composer = getByRole('textbox', { name: 'Message Unity Agent' });
		await fireEvent.input(composer, {
			target: { value: 'Inspect the Editor' },
		});
		await waitFor(() =>
			expect(getByRole('button', { name: 'Send message' })).toBeEnabled(),
		);
		await fireEvent.click(getByRole('button', { name: 'Send message' }));
		await findByText(/connected and ready for commands/);

		// One block for the prompt and one for the whole reply, however many
		// tool calls and message parts the reply is made of.
		expect(container.querySelectorAll('[data-ui="message"]')).toHaveLength(2);
		expect(
			container.querySelectorAll('[data-ui="tool-call"]').length,
		).toBeGreaterThan(1);
	});

	it('finds messages and tool arguments within the open thread', async () => {
		const { container, findByRole, getByRole } = renderApp();
		const composer = getByRole('textbox', { name: 'Message Unity Agent' });
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
