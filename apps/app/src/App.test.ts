import {
	cleanup,
	fireEvent,
	render,
	waitFor,
	within,
} from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import { FakeAgentClient } from './lib/agent-client';

const initialInnerWidth = window.innerWidth;

beforeEach(() => {
	localStorage.clear();
	// Routes live in the fragment, so a leftover page would open the next test
	// on the wrong screen.
	history.replaceState(null, '', '#');
});

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
			getByRole('slider', { name: 'Resize editor inspector' }),
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

	it('applies and persists device settings across its pages', async () => {
		const { findByRole, getByRole, getByText } = renderApp();
		await fireEvent.click(getByRole('button', { name: 'Settings' }));

		expect(
			await findByRole('region', { name: 'Settings' }),
		).toBeInTheDocument();
		// Settings opens on Appearance.
		const scheme = getByRole('button', { name: 'Color scheme' });
		expect(scheme).toHaveTextContent('Default');
		await fireEvent.click(getByRole('button', { name: 'Light' }));
		expect(document.documentElement).toHaveAttribute('data-theme', 'light');

		await fireEvent.click(getByRole('button', { name: 'Chat' }));
		const sendOnEnter = await findByRole('switch', {
			name: 'Send with Enter',
		});
		const expandReasoning = getByRole('switch', { name: 'Expand reasoning' });
		await fireEvent.click(sendOnEnter);
		await fireEvent.click(expandReasoning);

		expect(getByText('⌘/Ctrl Enter')).toBeInTheDocument();
		await waitFor(() => {
			const saved = JSON.parse(
				localStorage.getItem('unity-agent.settings.v1') ?? '{}',
			);
			expect(saved.sendOnEnter).toBe(false);
			expect(saved.expandReasoning).toBe(true);
			expect(saved.theme).toBe('light');
		});

		// Restoring defaults is destructive enough to confirm first.
		await fireEvent.click(getByRole('button', { name: 'About' }));
		await fireEvent.click(
			await findByRole('button', { name: 'Restore defaults' }),
		);
		const confirm = await findByRole('dialog', {
			name: 'Restore device settings?',
		});
		await fireEvent.click(
			within(confirm).getByRole('button', { name: 'Restore defaults' }),
		);
		await fireEvent.click(getByRole('button', { name: 'Chat' }));
		expect(
			await findByRole('switch', { name: 'Send with Enter' }),
		).toHaveAttribute('aria-checked', 'true');
	});

	it('tracks the system appearance when asked to', async () => {
		const { findByRole, getByRole } = renderApp();
		await fireEvent.click(getByRole('button', { name: 'Settings' }));
		await findByRole('region', { name: 'Settings' });

		await fireEvent.click(getByRole('button', { name: 'System' }));

		await waitFor(() => {
			const saved = JSON.parse(
				localStorage.getItem('unity-agent.settings.v1') ?? '{}',
			);
			expect(saved.followSystemTheme).toBe(true);
		});
	});

	it('browses server folders without asking for a typed path', async () => {
		const { findByRole, getByRole, queryByRole } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'Open workspace' }),
		);

		const dialog = await findByRole('dialog');
		expect(
			await within(dialog).findByText('ThirdPersonSandbox'),
		).toBeInTheDocument();
		expect(queryByRole('textbox', { name: 'Workspace path' })).toBeNull();
	});

	it('updates the folder list as the query changes', async () => {
		const { findByRole } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'Open workspace' }),
		);

		const dialog = await findByRole('dialog');
		const inDialog = within(dialog);
		await inDialog.findByText('ThirdPersonSandbox');

		await fireEvent.input(inDialog.getByPlaceholderText('Type a path, or search folders…'), {
			target: { value: 'render' },
		});

		expect(await inDialog.findByText('RenderingPlayground')).toBeInTheDocument();
		await waitFor(() =>
			expect(inDialog.queryByText('ThirdPersonSandbox')).toBeNull(),
		);
	});

	it('tabs into the highlighted folder to browse its subfolders', async () => {
		const { findByRole } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'Open workspace' }),
		);

		const dialog = await findByRole('dialog');
		const inDialog = within(dialog);
		await inDialog.findByText('ThirdPersonSandbox');
		const input = inDialog.getByPlaceholderText(
			'Type a path, or search folders…',
		) as HTMLInputElement;
		// bits-ui highlights the first item on the next tick after it mounts;
		// firing Tab before that lands would miss the selection entirely.
		await waitFor(() =>
			expect(
				dialog.querySelector('[data-ui="palette-result"][data-selected]'),
			).not.toBeNull(),
		);

		await fireEvent.keyDown(input, { key: 'Tab' });

		await waitFor(() =>
			expect(input.value).toBe('/projects/ThirdPersonSandbox/'),
		);
	});

	it('opens a workspace without opening or creating a thread', async () => {
		const { findAllByText, findByRole } = renderApp();
		const list = await findByRole('navigation', {
			name: 'Workspaces and threads',
		});
		await waitFor(() =>
			expect(
				list.querySelectorAll('[data-ui="session-item"]').length,
			).toBeGreaterThan(0),
		);
		const before = list.querySelectorAll('[data-ui="session-item"]').length;

		await fireEvent.click(
			await findByRole('button', { name: 'Open RenderingPlayground' }),
		);

		// A workspace is a place you open, not a thread you get dropped into.
		const screen = await findByRole('main', { name: 'Workspace' });
		expect(screen).toBeInTheDocument();
		expect(location.hash).toContain('#workspace/');
		expect((await findAllByText('RenderingPlayground')).length).toBeGreaterThan(
			0,
		);
		expect(list.querySelectorAll('[data-ui="session-item"]')).toHaveLength(
			before,
		);
		// It replaces the thread area rather than covering the whole window.
		expect(list).toBeVisible();
		expect(document.querySelector('[data-ui="app-shell"]')).not.toHaveAttribute(
			'inert',
		);
	});

	it('starts a thread in the workspace whose row was used', async () => {
		const { findByRole } = renderApp();
		const list = await findByRole('navigation', {
			name: 'Workspaces and threads',
		});
		await waitFor(() =>
			expect(
				list.querySelectorAll('[data-ui="session-item"]').length,
			).toBeGreaterThan(0),
		);

		await fireEvent.click(
			await findByRole('button', {
				name: 'New thread in RenderingPlayground',
			}),
		);

		await waitFor(() => {
			const rows = [...list.querySelectorAll('[data-ui="workspace-row"]')];
			const rendering = rows.find((row) =>
				row.textContent?.includes('RenderingPlayground'),
			);
			expect(rendering?.textContent).toContain('1 thread');
		});
	});

	it('switches the whole shell to a workspace before its data lands', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		// Hold the second Git call open so the loading window is observable.
		let release = () => {};
		const gate = new Promise<void>((resolve) => (release = resolve));
		const realGitStatus = client.invokeProjectExtension.bind(client);
		let calls = 0;
		vi.spyOn(client, 'invokeProjectExtension').mockImplementation(
			async (projectPath, extensionId, operation, input) => {
				if (extensionId === 'git' && operation === 'status') {
					if (++calls > 1) await gate;
				}
				return realGitStatus(projectPath, extensionId, operation, input);
			},
		);
		const { container, findByRole, getByRole } = render(App, { client });
		const list = await findByRole('navigation', {
			name: 'Workspaces and threads',
		});
		await waitFor(() =>
			expect(
				list.querySelectorAll('[data-ui="session-item"]').length,
			).toBeGreaterThan(0),
		);

		await fireEvent.click(
			getByRole('button', { name: 'Open RenderingPlayground' }),
		);

		// Screen, sidebar highlight and Git state all move together: the view is
		// already the new workspace, and nothing claims to know its Git state.
		expect(getByRole('main', { name: 'Workspace' })).toBeInTheDocument();
		const active = list.querySelector('[data-ui="workspace-row"][data-active]');
		expect(active?.textContent).toContain('RenderingPlayground');
		expect(
			container.querySelector('[aria-label="Loading source control"]'),
		).toBeInTheDocument();
		expect(container.textContent).not.toContain('Working tree clean');

		release();
		await waitFor(() =>
			expect(
				container.querySelector('[aria-label="Loading source control"]'),
			).toBeNull(),
		);
	});

	it('moves the whole shell when a thread in another workspace opens', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		let release = () => {};
		const gate = new Promise<void>((resolve) => (release = resolve));
		// Nothing resumes until the click below, so every call can be gated.
		const realResume = client.resumeSession.bind(client);
		vi.spyOn(client, 'resumeSession').mockImplementation(async (id) => {
			await gate;
			return realResume(id);
		});
		const { container, findByRole, getByRole } = render(App, { client });
		const list = await findByRole('navigation', {
			name: 'Workspaces and threads',
		});
		await waitFor(() =>
			expect(
				list.querySelectorAll('[data-ui="session-item"]').length,
			).toBeGreaterThan(0),
		);
		// A second thread, in the other workspace.
		await fireEvent.click(
			getByRole('button', { name: 'New thread in RenderingPlayground' }),
		);
		await waitFor(() =>
			expect(
				list.querySelectorAll('[data-ui="session-item"]').length,
			).toBeGreaterThan(1),
		);
		const first = list.querySelector<HTMLElement>('[data-ui="session-item"]')!;

		await fireEvent.click(first);

		// Selection and transcript state move now; the transcript itself waits.
		expect(first).toHaveAttribute('data-active');
		expect(
			container.querySelector('[aria-label="Loading thread"]'),
		).toBeInTheDocument();
		expect(container.textContent).not.toContain('Ask about your workspace to');

		release();
		await waitFor(() =>
			expect(
				container.querySelector('[aria-label="Loading thread"]'),
			).toBeNull(),
		);
	});

	it('never highlights a workspace and a thread at the same time', async () => {
		const { findByRole } = renderApp();
		const list = await findByRole('navigation', {
			name: 'Workspaces and threads',
		});
		await waitFor(() =>
			expect(
				list.querySelectorAll('[data-ui="session-item"][data-active]').length,
			).toBe(1),
		);
		expect(
			list.querySelectorAll('[data-ui="workspace-row"][data-active]'),
		).toHaveLength(0);

		await fireEvent.click(
			await findByRole('button', { name: 'Open ThirdPersonSandbox' }),
		);
		await findByRole('main', { name: 'Workspace' });

		await waitFor(() =>
			expect(
				list.querySelectorAll('[data-ui="workspace-row"][data-active]').length,
			).toBe(1),
		);
		expect(
			list.querySelectorAll('[data-ui="session-item"][data-active]'),
		).toHaveLength(0);
	});

	it('opens the thread itself when one is picked from a workspace screen', async () => {
		const { findByRole, getByRole, queryByRole } = renderApp();
		const list = await findByRole('navigation', {
			name: 'Workspaces and threads',
		});
		await waitFor(() =>
			expect(
				list.querySelectorAll('[data-ui="session-item"]').length,
			).toBeGreaterThan(0),
		);

		await fireEvent.click(
			await findByRole('button', { name: 'Open ThirdPersonSandbox' }),
		);
		await findByRole('main', { name: 'Workspace' });

		// Picking a thread has to leave the workspace screen, not just swap
		// which session is loaded behind it.
		const thread = list.querySelector<HTMLElement>('[data-ui="session-item"]')!;
		await fireEvent.click(thread);

		await waitFor(() =>
			expect(queryByRole('main', { name: 'Workspace' })).toBeNull(),
		);
		expect(getByRole('textbox', { name: 'Message Gizmo' })).toBeInTheDocument();
		expect(location.hash).not.toContain('workspace');
	});

	it('opens workspace settings as a tab on the workspace screen', async () => {
		const { findByRole, findByText } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'ThirdPersonSandbox settings' }),
		);

		expect(await findByRole('main', { name: 'Workspace' })).toBeInTheDocument();
		expect(location.hash).toContain('/configure');

		// Extensions belong to a profile, so they are listed on the Configure tab;
		// one rooted outside the workspace root shows where it lives.
		await fireEvent.click(await findByRole('tab', { name: 'Configure' }));
		expect(await findByText('WebFrontend')).toBeInTheDocument();
	});

	it('overrides a skill for the open workspace only', async () => {
		const { findByRole, getByRole } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'ThirdPersonSandbox settings' }),
		);
		await findByRole('main', { name: 'Workspace' });
		await fireEvent.click(await findByRole('tab', { name: 'Configure' }));

		// On globally, so the workspace switch starts on and can be turned off.
		const skill = await findByRole('switch', {
			name: 'svelte-code-writer enabled',
		});
		expect(skill).toHaveAttribute('aria-checked', 'true');
		await fireEvent.click(skill);
		await waitFor(() =>
			expect(
				getByRole('switch', { name: 'svelte-code-writer enabled' }),
			).toHaveAttribute('aria-checked', 'false'),
		);

		// The override is part of the profile, so it lands when the profile saves.
		await fireEvent.click(getByRole('button', { name: 'Save' }));
		await waitFor(() =>
			expect(getByRole('button', { name: 'Save' })).toBeDisabled(),
		);
		expect(
			getByRole('switch', { name: 'svelte-code-writer enabled' }),
		).toHaveAttribute('aria-checked', 'false');
	});

	it('marks what a profile changes from its base and reverts a row', async () => {
		const { findByRole, getByRole } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'ThirdPersonSandbox settings' }),
		);
		await findByRole('main', { name: 'Workspace' });
		await fireEvent.click(await findByRole('tab', { name: 'Configure' }));

		// The workspace profile turns on both extensions; Default turns on none.
		const unity = (await findByRole('checkbox', { name: /Unity/ })).closest(
			'[data-ui="integration-row"]',
		)!;
		expect(unity).toHaveAttribute('data-changed', 'true');

		await fireEvent.click(
			getByRole('button', { name: 'Unity changed from Default' }),
		);
		await fireEvent.click(
			await findByRole('menuitem', { name: 'Revert to Default' }),
		);

		await waitFor(() =>
			expect(
				getByRole('checkbox', { name: /Unity/ }).closest(
					'[data-ui="integration-row"]',
				),
			).not.toHaveAttribute('data-changed'),
		);
	});

	it('duplicates a profile and makes the copy the active one', async () => {
		const { findByRole, getByRole } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'ThirdPersonSandbox settings' }),
		);
		await findByRole('main', { name: 'Workspace' });
		await fireEvent.click(await findByRole('tab', { name: 'Configure' }));

		// Duplicating keeps the extensions the workspace already had, and the copy
		// becomes the active profile without a separate step.
		await fireEvent.click(await findByRole('button', { name: 'Duplicate' }));
		const name = getByRole('textbox', { name: 'Profile name' });
		await fireEvent.input(name, { target: { value: 'Docs only' } });
		await fireEvent.click(getByRole('button', { name: 'Save' }));

		await waitFor(() =>
			expect(getByRole('button', { name: 'Save' })).toBeDisabled(),
		);
		// The saved profile is the active one, and reloading the tab keeps it.
		await fireEvent.click(getByRole('tab', { name: 'Overview' }));
		await fireEvent.click(getByRole('tab', { name: 'Configure' }));
		expect(await findByRole('textbox', { name: 'Profile name' })).toHaveValue(
			'Docs only',
		);
	});

	it('streams a fake agent response through the production UI state', async () => {
		const { findAllByText, findByText, getByRole, queryByRole } = renderApp();
		const composer = getByRole('textbox', { name: 'Message Gizmo' });
		const send = getByRole('button', { name: 'Send message' });
		await fireEvent.input(composer, {
			target: { value: 'Inspect the Editor' },
		});
		await waitFor(() => expect(send).toBeEnabled());
		await fireEvent.click(send);

		expect((await findAllByText('Inspect the Editor')).length).toBeGreaterThan(
			0,
		);
		expect((await findAllByText('Unity Editor status')).length).toBeGreaterThan(
			0,
		);
		expect(
			await findByText(/connected and ready for commands/),
		).toBeInTheDocument();
		expect(
			(await findAllByText('/projects/ThirdPersonSandbox')).length,
		).toBeGreaterThan(0);
		await waitFor(() =>
			expect(
				queryByRole('button', { name: 'Stop response' }),
			).not.toBeInTheDocument(),
		);
	});

	it('filters threads by title from the sidebar search', async () => {
		const { container, findByRole, getByRole } = renderApp();
		await findByRole('button', {
			name: 'New thread in ThirdPersonSandbox',
		});
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
			getByRole('navigation', { name: 'Workspaces and threads' }),
		).toHaveTextContent('No matching threads');
	});

	it('confirms thread deletion with a cancel path and reports the result', async () => {
		const { container, findByRole, getByRole, queryByRole } = renderApp();
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

	it('does not offer prompt retry when the agent connection drops', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const { findByRole, findByText, queryByRole } = render(App, { client });
		await findByRole('button', {
			name: 'New thread in ThirdPersonSandbox',
		});
		expect(queryByRole('button', { name: 'Retry' })).toBeNull();

		client.dropConnection();

		expect(await findByText('Local agent offline')).toBeInTheDocument();
		expect(queryByRole('button', { name: 'Retry' })).toBeNull();
	});

	it('opens the Pi session tree from the thread header', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const { findByRole, getByRole, getByText } = render(App, { client });
		await findByRole('button', {
			name: 'New thread in ThirdPersonSandbox',
		});

		const treeButton = getByRole('button', { name: 'Tree' });
		expect(
			treeButton.closest('[data-ui="conversation-header"]'),
		).not.toBeNull();
		await fireEvent.click(treeButton);

		expect(
			await findByRole('region', { name: 'Session tree' }),
		).toBeInTheDocument();
		expect(
			getByText(/including the branches it walked away from/),
		).toBeVisible();
	});

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

	it('shows the complete repository status in the Git tab', async () => {
		const { container, findByRole, getByRole } = renderApp();
		const composer = getByRole('textbox', { name: 'Message Gizmo' });
		await fireEvent.input(composer, {
			target: { value: 'Speed the player up' },
		});
		await waitFor(() =>
			expect(getByRole('button', { name: 'Send message' })).toBeEnabled(),
		);
		await fireEvent.click(getByRole('button', { name: 'Send message' }));

		const changesTab = await findByRole('tab', { name: /Git/ });
		await waitFor(() =>
			expect(
				changesTab.querySelector('[data-ui="tabs-badge"]'),
			).toHaveTextContent('1'),
		);
		expect(container.querySelector('[data-ui="change-list"]')).toBeNull();
		await fireEvent.click(changesTab);

		expect(
			await findByRole('button', { name: /Player\.cs/ }),
		).toBeInTheDocument();
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
		await findByText(/connected and ready for commands/);

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
