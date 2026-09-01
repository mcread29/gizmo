import { fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import App from '../../src/App.svelte';
import { FakeAgentClient } from '../../src/lib/agent-client';
import { renderApp, setupAppIntegrationTests } from '../support/app';

setupAppIntegrationTests();

describe('application shell and global interactions', () => {
	it('renders the primary workspace regions', async () => {
		const { findByRole, getByRole } = renderApp();

		expect(getByRole('main')).toBeInTheDocument();
		expect(
			await findByRole('navigation', { name: 'Workspaces and threads' }),
		).toBeInTheDocument();
		expect(
			getByRole('complementary', { name: 'Workspace inspector' }),
		).toBeInTheDocument();
		expect(getByRole('textbox', { name: 'Message Gizmo' })).toBeInTheDocument();
	});

	it('collapses each docked panel to a rail that reopens it', async () => {
		Object.defineProperty(window, 'innerWidth', {
			configurable: true,
			value: 1440,
		});
		const { findByRole, getByRole } = renderApp();

		expect(
			await findByRole('slider', { name: 'Resize thread sidebar' }),
		).toBeInTheDocument();
		expect(
			getByRole('slider', { name: 'Resize workspace inspector' }),
		).toBeInTheDocument();

		// Each panel carries its own toggle while it is open.
		const leftToggle = await findByRole('button', {
			name: 'Toggle thread sidebar',
		});
		const rightToggle = getByRole('button', {
			name: 'Toggle workspace inspector',
		});
		expect(leftToggle).toHaveAttribute('aria-expanded', 'true');
		expect(rightToggle).toHaveAttribute('aria-expanded', 'true');

		await fireEvent.click(leftToggle);
		await fireEvent.click(rightToggle);

		// Collapsing hands the control to the rail, which reopens the panel.
		const leftRail = getByRole('button', { name: 'Toggle thread sidebar' });
		const rightRail = getByRole('button', {
			name: 'Toggle workspace inspector',
		});
		expect(leftRail).toHaveAttribute('aria-expanded', 'false');
		expect(rightRail).toHaveAttribute('aria-expanded', 'false');

		await fireEvent.click(leftRail);
		expect(
			getByRole('button', { name: 'Toggle thread sidebar' }),
		).toHaveAttribute('aria-expanded', 'true');
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
		const newThread = await findByRole('button', {
			name: 'New thread in ThirdPersonSandbox',
		});
		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-ui="session-item"]').length,
			).toBeGreaterThan(0),
		);
		await fireEvent.click(newThread);

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

	it('renders and resolves semantic UI requested by a Pi extension', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const { findByRole, findByText, getByRole } = render(App, { client });
		await findByRole('textbox', { name: 'Message Gizmo' });
		await waitFor(async () =>
			expect((await client.listSessions()).sessions).toHaveLength(1),
		);
		const sessionId = (await client.listSessions()).sessions[0]!.id;

		client.emitExtensionUi(sessionId, {
			method: 'confirm',
			title: 'Publish changes?',
			message: 'The extension is ready to publish this workspace.',
		});
		expect(
			await findByText('The extension is ready to publish this workspace.'),
		).toBeInTheDocument();
		await fireEvent.click(getByRole('button', { name: 'Yes' }));
		await waitFor(() =>
			expect(client.extensionUiResponses[0]?.response).toEqual({
				kind: 'confirmed',
				confirmed: true,
			}),
		);

		client.emitExtensionUi(sessionId, {
			method: 'notify',
			message: 'Extension connected',
			notificationType: 'info',
		});
		expect(await findByText('Extension connected')).toBeInTheDocument();
	});

	it('offers slash commands and skills from the active Pi runtime', async () => {
		const { findByRole, getByRole } = render(App, {
			client: new FakeAgentClient({
				latencyMs: 0,
				commands: [
					{
						name: 'deploy',
						description: 'Deploy the current workspace',
						source: 'extension',
					},
					{
						name: 'skill:review',
						description: 'Review changes before commit',
						source: 'skill',
					},
				],
			}),
		});
		const composer = getByRole('textbox', { name: 'Message Gizmo' });
		await fireEvent.input(composer, { target: { value: '/skill' } });

		const option = await findByRole('option', { name: /skill:review/i });
		expect(option).toHaveTextContent('Skill');
		await fireEvent.keyDown(composer, { key: 'Enter' });
		expect(composer).toHaveValue('/skill:review ');
	});

	it('grows the composer before enabling its scrollbar', async () => {
		const { getByRole } = renderApp();
		const composer = getByRole('textbox', {
			name: 'Message Gizmo',
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

	it('strips the title bar to what still works while a screen is up', async () => {
		const { container, findByRole, getByRole } = renderApp();
		await findByRole('button', { name: 'Model' });
		const titlebar = () =>
			within(container.querySelector<HTMLElement>('[data-ui="titlebar"]')!);
		expect(
			titlebar().getByRole('button', { name: 'Settings' }),
		).toBeInTheDocument();
		expect(
			titlebar().getByRole('button', { name: 'Toggle color theme' }),
		).toBeInTheDocument();

		await fireEvent.click(getByRole('button', { name: 'Settings' }));
		await findByRole('region', { name: 'Settings' });

		// Nothing left in the bar acts on the covered workspace.
		expect(
			titlebar().queryByRole('button', { name: 'Settings' }),
		).not.toBeInTheDocument();
		expect(
			titlebar().queryByRole('button', { name: 'Toggle color theme' }),
		).not.toBeInTheDocument();
		expect(titlebar().queryByText('Svelte')).not.toBeInTheDocument();

		// Leaving the screen goes through history, so the bar restores async.
		await fireEvent.click(getByRole('button', { name: 'Back' }));
		await waitFor(() =>
			expect(
				titlebar().getByRole('button', { name: 'Settings' }),
			).toBeInTheDocument(),
		);
	});
});
