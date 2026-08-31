import { fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/App.svelte';
import { FakeAgentClient } from '../../src/lib/agent-client';
import { renderApp, setupAppIntegrationTests } from '../support/app';

setupAppIntegrationTests();

describe('device settings and workspace picker', () => {
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
				localStorage.getItem('gizmo.settings.v1') ?? '{}',
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
				localStorage.getItem('gizmo.settings.v1') ?? '{}',
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

		await fireEvent.input(
			inDialog.getByPlaceholderText('Type a path, or search folders…'),
			{
				target: { value: 'render' },
			},
		);

		expect(
			await inDialog.findByText('RenderingPlayground'),
		).toBeInTheDocument();
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

	it('adds the tab-completed directory rather than its highlighted child', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const addProject = vi.spyOn(client, 'addProject');
		const { findByRole } = render(App, { client });
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'Open workspace' }),
		);

		const dialog = await findByRole('dialog');
		const input = within(dialog).getByPlaceholderText(
			'Type a path, or search folders…',
		) as HTMLInputElement;
		await waitFor(() =>
			expect(
				dialog.querySelector('[data-ui="palette-result"][data-selected]'),
			).not.toBeNull(),
		);
		await fireEvent.keyDown(input, { key: 'Tab' });
		await waitFor(() =>
			expect(input.value).toBe('/projects/ThirdPersonSandbox/'),
		);
		await fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() =>
			expect(addProject).toHaveBeenCalledWith('/projects/ThirdPersonSandbox'),
		);
	});
});
