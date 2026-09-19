import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { ActionEvent, View } from '@gizmo/extension-api';
import ViewRenderer from '../../../../src/lib/extensions/view/ViewRenderer.svelte';
import type { ViewIntentHost } from '../../../../src/lib/extensions/view/intents';

function host(overrides: Partial<ViewIntentHost> = {}): ViewIntentHost {
	return {
		openFile: vi.fn(),
		openDiff: vi.fn(),
		openThread: vi.fn(),
		openUrl: vi.fn(),
		...overrides,
	};
}

const files: View['blocks'][number] = {
	type: 'list',
	id: 'files',
	items: [
		{ id: 'a', label: 'a.ts' },
		{ id: 'b', label: 'b.ts' },
	],
};

describe('rows', () => {
	it('renders each pane of a split', () => {
		const view: View = {
			title: 'Split',
			blocks: [
				{
					type: 'split',
					panes: [
						{ blocks: [files], grow: 2 },
						{ blocks: [{ type: 'text', text: 'the detail' }], grow: 3 },
					],
				},
			],
		};

		render(ViewRenderer, { view, host: host() });

		expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument();
		expect(screen.getByText('the detail')).toBeInTheDocument();
	});

	it('draws a badge and an icon on a row that asks for one', () => {
		const view: View = {
			title: 'Changes',
			blocks: [
				{
					type: 'tree',
					id: 'unstaged',
					nodes: [
						{
							id: 'a',
							label: 'a.ts',
							icon: 'file-diff',
							badge: { text: 'M', tone: 'info' },
						},
					],
				},
			],
		};

		render(ViewRenderer, { view, host: host() });

		const badge = screen.getByText('M');
		expect(badge).toHaveAttribute('data-ui', 'view-row-badge');
		expect(badge).toHaveAttribute('data-tone', 'info');
	});

	it('runs an item action on its own row, not on the picked one', async () => {
		const events: ActionEvent[] = [];
		const view: View = {
			title: 'Changes',
			blocks: [files],
			actions: [
				{
					id: 'stage',
					label: 'Stage',
					placement: 'item',
					selection: { blockId: 'files' },
				},
			],
		};

		render(ViewRenderer, {
			view,
			host: host(),
			onAction: (event: ActionEvent) => events.push(event),
		});

		// One button per row, and none in the action bar.
		const staged = screen.getAllByRole('button', { name: 'Stage' });
		expect(staged).toHaveLength(2);

		await fireEvent.click(screen.getByRole('button', { name: /a\.ts/ }));
		await fireEvent.click(staged[1]);
		expect(events).toEqual([
			{
				actionId: 'stage',
				selection: { blockId: 'files', itemId: 'b' },
				cancelled: false,
			},
		]);
	});

	it('runs a block’s onSelect action when a row is picked, and hides it', async () => {
		const events: ActionEvent[] = [];
		const view: View = {
			title: 'Changes',
			blocks: [{ ...files, onSelect: 'show-diff' }],
			actions: [{ id: 'show-diff', label: 'Show diff' }],
		};

		render(ViewRenderer, {
			view,
			host: host(),
			onAction: (event: ActionEvent) => events.push(event),
		});

		expect(
			screen.queryByRole('button', { name: 'Show diff' }),
		).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /b\.ts/ }));
		expect(events).toEqual([
			{
				actionId: 'show-diff',
				selection: { blockId: 'files', itemId: 'b' },
				cancelled: false,
			},
		]);
	});
	const tree: View['blocks'][number] = {
		type: 'tree',
		id: 'unstaged',
		nodes: [
			{
				id: 'src',
				label: 'src',
				// The folder can be staged whole, but there is no file to open.
				actions: ['stage'],
				children: [{ id: 'src/a', label: 'a.ts' }],
			},
		],
	};
	const itemActions: View['actions'] = [
		{
			id: 'open',
			label: 'Open file',
			placement: 'item',
			selection: { blockId: 'unstaged' },
		},
		{
			id: 'stage',
			label: 'Stage',
			placement: 'item',
			selection: { blockId: 'unstaged' },
		},
	];

	it('draws a folder only the actions it names, and runs them on it', async () => {
		const events: ActionEvent[] = [];

		render(ViewRenderer, {
			view: { title: 'Changes', blocks: [tree], actions: itemActions },
			host: host(),
			onAction: (event: ActionEvent) => events.push(event),
		});

		// Both rows stage; only the file underneath can be opened.
		expect(screen.getAllByRole('button', { name: 'Stage' })).toHaveLength(2);
		expect(screen.getAllByRole('button', { name: 'Open file' })).toHaveLength(
			1,
		);

		await fireEvent.click(screen.getAllByRole('button', { name: 'Stage' })[0]);
		expect(events).toEqual([
			{
				actionId: 'stage',
				selection: { blockId: 'unstaged', itemId: 'src' },
				cancelled: false,
			},
		]);
	});

	it('folds a folder away when its row is clicked', async () => {
		render(ViewRenderer, {
			view: { title: 'Changes', blocks: [tree] },
			host: host(),
		});

		await fireEvent.click(screen.getByRole('button', { name: /src/ }));
		expect(
			screen.queryByRole('button', { name: /a\.ts/ }),
		).not.toBeInTheDocument();
	});
});
