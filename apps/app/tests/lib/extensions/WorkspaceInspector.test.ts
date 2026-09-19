import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { ViewSummary } from '@gizmo/extension-api';
import type { AgentStore } from '../../../src/lib/agent-client';
import WorkspaceInspector from '../../../src/lib/extensions/WorkspaceInspector.svelte';
import { extensionUi } from '../../../src/lib/extensions/extension-ui.svelte.ts';
import { WorkspaceLayout } from '../../../src/lib/features/shell/workspace.svelte.ts';
import { extensionUiFixture } from './fixtures/ui.ts';

function store(): AgentStore {
	return {
		messages: [],
		selectedProjectPath: '/projects/game',
		sessionId: undefined,
		// Views talk to the transport directly; nothing here opens one.
		client: {
			subscribe: () => () => {},
			openExtensionView: async () => undefined,
			closeExtensionView: async () => {},
		},
	} as unknown as AgentStore;
}

function view(id: string, label: string): ViewSummary {
	return { id, label, scope: 'workspace', placement: 'inspector' };
}

describe('WorkspaceInspector', () => {
	it('renders one tab per contributed inspector view', async () => {
		extensionUi.extensions = [
			extensionUiFixture('git', { views: [view('changes', 'Changes')] }),
			extensionUiFixture('activity', {
				views: [
					view('panel', 'Activity'),
					{
						id: 'about',
						label: 'About',
						scope: 'workspace',
						placement: 'modal',
					},
				],
			}),
		];
		const inspector = render(WorkspaceInspector, {
			store: store(),
			layout: new WorkspaceLayout(),
			hidden: false,
		});

		expect(
			await inspector.findByRole('tab', { name: 'Changes' }),
		).toBeInTheDocument();
		expect(
			await inspector.findByRole('tab', { name: 'Activity' }),
		).toBeInTheDocument();
		// A modal view is not an inspector tab.
		expect(inspector.queryByRole('tab', { name: 'About' })).toBeNull();
		inspector.unmount();
	});

	it('owns the empty inspector state when no enabled extension contributes UI', () => {
		extensionUi.extensions = [];
		const inspector = render(WorkspaceInspector, {
			store: store(),
			layout: new WorkspaceLayout(),
			hidden: false,
		});

		expect(
			inspector.getByText('No inspector extensions enabled'),
		).toBeInTheDocument();
		inspector.unmount();
	});
});

it('updates the tab badge without reopening the view', async () => {
	extensionUi.extensions = [
		extensionUiFixture('git', { views: [view('changes', 'Changes')] }),
	];
	const active = store();
	const open = vi.fn(async () => ({ title: 'Changes', badge: 3, blocks: [] }));
	active.client.openExtensionView = open;
	const inspector = render(WorkspaceInspector, {
		store: active,
		layout: new WorkspaceLayout(),
		hidden: false,
	});
	await waitFor(() =>
		expect(inspector.getByRole('tab', { name: /Changes/ })).toHaveTextContent(
			'3',
		),
	);
	expect(open).toHaveBeenCalledTimes(1);
});
