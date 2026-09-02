import { fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import App from '../../src/App.svelte';
import { FakeAgentClient } from '../../src/lib/agent-client';
import { renderApp, setupAppIntegrationTests } from '../support/app';

setupAppIntegrationTests();

describe('workspace configuration and thread sidebar', () => {
	it('opens workspace settings as a tab on the workspace screen', async () => {
		const { findByRole, findAllByText } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'ThirdPersonSandbox settings' }),
		);

		expect(await findByRole('main', { name: 'Workspace' })).toBeInTheDocument();
		expect(location.hash).toContain('/configure');

		// Installed extensions are listed on the Configure tab, inheriting the
		// global state until this workspace overrides them.
		await fireEvent.click(await findByRole('tab', { name: 'Configure' }));
		expect(
			(await findAllByText('Inherits global · on')).length,
		).toBeGreaterThan(0);
	});

	it('overrides a skill for the open workspace only', async () => {
		const { findByRole, findByText, getByRole } = renderApp();
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

		// The override lands immediately; there is no profile save step anymore.
		expect(await findByText('Off here')).toBeInTheDocument();
	});

	it('overrides a Gizmo extension for the workspace and reverts it', async () => {
		const { findByRole, getByRole } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'ThirdPersonSandbox settings' }),
		);
		await findByRole('main', { name: 'Workspace' });
		await fireEvent.click(await findByRole('tab', { name: 'Configure' }));

		// The workspace turns Unity off despite the global switch being on.
		await fireEvent.click(
			await findByRole('switch', { name: 'Unity enabled here' }),
		);
		await findByRole('switch', { name: 'Unity enabled here' });
		await waitFor(() =>
			expect(
				getByRole('switch', { name: 'Unity enabled here' }).closest(
					'[data-ui="integration-row"]',
				),
			).toHaveAttribute('data-changed', 'true'),
		);

		// Clearing the override inherits the global state again. The row's
		// reset button is targeted directly: every row renders one, hidden
		// until it has an override to clear.
		const row = getByRole('switch', {
			name: 'Unity enabled here',
		}).closest('[data-ui="integration-row"]')!;
		await fireEvent.click(
			within(row as HTMLElement).getByRole('button', { name: 'Use global' }),
		);
		await waitFor(() =>
			expect(
				getByRole('switch', { name: 'Unity enabled here' }).closest(
					'[data-ui="integration-row"]',
				),
			).not.toHaveAttribute('data-changed'),
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
			await findByRole('dialog', { name: 'Session tree' }),
		).toBeInTheDocument();
		expect(
			getByText(/including the branches it walked away from/),
		).toBeVisible();
	});
});
