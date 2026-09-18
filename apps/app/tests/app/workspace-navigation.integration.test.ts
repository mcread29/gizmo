import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/App.svelte';
import { FakeAgentClient } from '../../src/lib/agent-client';
import { renderApp, setupAppIntegrationTests } from '../support/app';

setupAppIntegrationTests();

describe('workspace navigation', () => {
	it('puts the workspace back on the thread when returning to the open one', async () => {
		const { findByRole, findAllByText } = renderApp();
		const list = await findByRole('navigation', {
			name: 'Workspaces and threads',
		});
		await waitFor(() =>
			expect(
				list.querySelectorAll('[data-ui="session-item"]').length,
			).toBeGreaterThan(0),
		);
		const thread = list.querySelector<HTMLElement>('[data-ui="session-item"]')!;
		await fireEvent.click(thread);
		// Give the thread a transcript: an empty one proves nothing about
		// whether returning to it brings its messages back.
		const composer = await findByRole('textbox', { name: 'Message Gizmo' });
		await fireEvent.input(composer, {
			target: { value: 'Inspect the Editor' },
		});
		await waitFor(() =>
			expect(document.querySelectorAll('[data-ui="message"]').length).toBe(0),
		);
		await fireEvent.click(await findByRole('button', { name: 'Send message' }));
		await waitFor(() =>
			expect(
				document.querySelectorAll('[data-ui="message"]').length,
			).toBeGreaterThan(0),
		);
		const header = await findByRole('main', { name: 'Thread' }).catch(
			async () => document.querySelector('[data-ui="conversation-header"]')!,
		);
		const workspaceOf = () =>
			document
				.querySelector('[data-ui="conversation-header"] h1')
				?.textContent?.trim();
		const opened = workspaceOf();
		expect(header).toBeTruthy();

		// A workspace screen moves the selected workspace…
		await fireEvent.click(
			await findByRole('button', { name: 'Open RenderingPlayground' }),
		);
		await findByRole('main', { name: 'Workspace' });
		expect((await findAllByText('RenderingPlayground')).length).toBeGreaterThan(
			0,
		);

		// …and returning to the thread that never closed has to move it back,
		// or the header and inspector keep describing the workspace instead.
		await fireEvent.click(thread);
		await waitFor(() => expect(workspaceOf()).toBe(opened));
		// The workspace screen discarded the transcript on the way through; the
		// thread has to come back with it, not as an empty conversation.
		await waitFor(() =>
			expect(
				document.querySelectorAll('[data-ui="message"]').length,
			).toBeGreaterThan(0),
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
			// The row shows the workspace name only — no path, no "1 thread"
			// caption — so the thread itself is what proves where it landed.
			expect(rendering?.textContent).not.toContain('/projects/');
			const threads = rendering?.nextElementSibling;
			expect(threads?.getAttribute('data-ui')).toBe('workspace-threads');
			expect(
				threads?.querySelectorAll('[data-ui="session-item"]'),
			).toHaveLength(1);
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

		// Screen and sidebar highlight move together. Git is not enabled for this
		// workspace, so switching never probes it or mounts source-control UI.
		expect(getByRole('main', { name: 'Workspace' })).toBeInTheDocument();
		const active = list.querySelector('[data-ui="workspace-row"][data-active]');
		expect(active?.textContent).toContain('RenderingPlayground');
		expect(
			container.querySelector('[aria-label="Loading source control"]'),
		).toBeNull();
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
		// Give the thread a transcript: an empty one proves nothing about
		// whether returning to it brings its messages back.
		const composer = await findByRole('textbox', { name: 'Message Gizmo' });
		await fireEvent.input(composer, {
			target: { value: 'Inspect the Editor' },
		});
		await waitFor(() =>
			expect(document.querySelectorAll('[data-ui="message"]').length).toBe(0),
		);
		await fireEvent.click(await findByRole('button', { name: 'Send message' }));
		await waitFor(() =>
			expect(
				document.querySelectorAll('[data-ui="message"]').length,
			).toBeGreaterThan(0),
		);

		await waitFor(() =>
			expect(queryByRole('main', { name: 'Workspace' })).toBeNull(),
		);
		expect(getByRole('textbox', { name: 'Message Gizmo' })).toBeInTheDocument();
		expect(location.hash).not.toContain('workspace');
	});
});
