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
		expect(location.hash).toContain('/instructions');

		// Installed extensions are listed on the Extensions tab, inheriting the
		// global state until this workspace overrides them.
		await fireEvent.click(await findByRole('tab', { name: 'Extensions' }));
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
		await fireEvent.click(await findByRole('tab', { name: 'Skills' }));

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
		await fireEvent.click(await findByRole('tab', { name: 'Extensions' }));

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

	it('reverts a skill override from the workspace overview', async () => {
		const { findByRole, findByText, getByRole, queryByText } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'ThirdPersonSandbox settings' }),
		);
		await findByRole('main', { name: 'Workspace' });
		await fireEvent.click(await findByRole('tab', { name: 'Skills' }));
		await fireEvent.click(
			await findByRole('switch', { name: 'svelte-code-writer enabled' }),
		);
		await findByText('Off here');

		// Overview names the departure without making you open the tab again.
		await fireEvent.click(getByRole('tab', { name: 'Overview' }));
		const row = (await findByText('Off here · on globally')).closest(
			'[data-ui="workspace-override-row"]',
		)!;
		await fireEvent.click(
			within(row as HTMLElement).getByRole('button', { name: 'Use global' }),
		);

		await waitFor(() =>
			expect(queryByText('Off here · on globally')).toBeNull(),
		);
		await findByText(
			'Nothing is overridden — this workspace follows your global settings.',
		);
	});

	it('asks before leaving an unsaved AGENTS.md', async () => {
		const { findByRole, getByRole } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(
			await findByRole('button', { name: 'ThirdPersonSandbox settings' }),
		);
		await findByRole('main', { name: 'Workspace' });

		const editor = await findByRole('textbox', { name: 'AGENTS.md Markdown' });
		await fireEvent.input(editor, { target: { value: 'Draft guidance' } });

		// Cancelling keeps both the tab and the draft.
		await fireEvent.click(getByRole('tab', { name: 'Skills' }));
		const dialog = await findByRole('dialog', {
			name: 'Discard unsaved changes?',
		});
		await fireEvent.click(
			within(dialog).getByRole('button', { name: 'Cancel' }),
		);
		expect(location.hash).toContain('/instructions');
		expect(
			await findByRole('textbox', { name: 'AGENTS.md Markdown' }),
		).toHaveValue('Draft guidance');

		// Discarding leaves, and drops the draft rather than stranding it
		// behind a disabled Save button.
		await fireEvent.click(getByRole('tab', { name: 'Skills' }));
		await fireEvent.click(
			within(
				await findByRole('dialog', { name: 'Discard unsaved changes?' }),
			).getByRole('button', { name: 'Discard' }),
		);
		await waitFor(() => expect(location.hash).toContain('/skills'));

		await fireEvent.click(getByRole('tab', { name: 'Instructions & tools' }));
		expect(
			await findByRole('textbox', { name: 'AGENTS.md Markdown' }),
		).toHaveValue('');
	});

	it('shows only a header row for a workspace without threads', async () => {
		const { findByRole, getByRole } = renderApp();
		await findByRole('button', { name: 'Open RenderingPlayground' });
		const row = getByRole('group', { name: 'RenderingPlayground' });
		expect(
			within(row).queryByRole('button', { name: /Expand|Collapse/ }),
		).toBeNull();
		expect(row.nextElementSibling?.getAttribute('data-ui')).not.toBe(
			'workspace-threads',
		);
		expect(
			within(row).getByRole('button', {
				name: 'New thread in RenderingPlayground',
			}),
		).toBeEnabled();
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

		// The thread's own controls live on the shelf row, beside its title,
		// where the workspace screen puts its own tab strip.
		const treeButton = getByRole('button', { name: 'Tree' });
		expect(treeButton.closest('[data-ui="conversation-shelf"]')).not.toBeNull();
		await fireEvent.click(treeButton);

		expect(getByText('Paths through this thread')).toBeVisible();
		expect(
			await findByRole('dialog', { name: 'Session tree' }),
		).toBeInTheDocument();
		expect(getByText(/Every turn is kept.*alternate path/)).toBeVisible();
	});
});
