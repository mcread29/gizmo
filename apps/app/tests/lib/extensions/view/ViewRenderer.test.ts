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

describe('ViewRenderer', () => {
	it('renders every block type', () => {
		const view: View = {
			title: 'Everything',
			blocks: [
				{ type: 'heading', text: 'Heading one', level: 1 },
				{ type: 'text', text: 'Some prose' },
				{ type: 'markdown', markdown: '**bold text**' },
				{ type: 'keyValue', entries: [{ label: 'Branch', value: 'pi-web' }] },
				{ type: 'metric', label: 'Errors', value: '3' },
				{
					type: 'list',
					id: 'files',
					items: [{ id: 'a', label: 'a.ts' }],
				},
				{
					type: 'table',
					id: 'changes',
					columns: [{ id: 'file', label: 'File' }],
					rows: [{ id: 'one', cells: { file: 'src/app.ts' } }],
				},
				{
					type: 'tree',
					id: 'outline',
					nodes: [{ id: 'root', label: 'src', children: [] }],
				},
				{ type: 'progress', value: 2, max: 4, label: 'Compiling' },
				{ type: 'log', lines: [{ text: 'started' }] },
				{ type: 'code', code: 'const answer = 42;', label: 'snippet' },
				{ type: 'diff', diff: '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new\n' },
				{
					type: 'section',
					title: 'Details',
					blocks: [{ type: 'text', text: 'Inside the section' }],
				},
				{ type: 'divider' },
				{ type: 'link', text: 'Docs', url: 'https://example.com/docs' },
			],
		};

		render(ViewRenderer, { view, host: host() });

		expect(screen.getByText('Heading one')).toBeInTheDocument();
		expect(screen.getByText('Some prose')).toBeInTheDocument();
		expect(screen.getByText('bold text')).toBeInTheDocument();
		expect(screen.getByText('Branch')).toBeInTheDocument();
		expect(screen.getByText('Errors')).toBeInTheDocument();
		expect(screen.getByText('a.ts')).toBeInTheDocument();
		expect(screen.getByText('src/app.ts')).toBeInTheDocument();
		expect(screen.getByText('src')).toBeInTheDocument();
		expect(screen.getByText('Compiling')).toBeInTheDocument();
		expect(screen.getByText('started')).toBeInTheDocument();
		expect(screen.getByText(/const answer/)).toBeInTheDocument();
		expect(screen.getByText('Details')).toBeInTheDocument();
		expect(screen.getByText('Inside the section')).toBeInTheDocument();
		const link = screen.getByRole('link', { name: 'Docs' });
		expect(link).toHaveAttribute('href', 'https://example.com/docs');
		expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('keeps a selection-required action disabled until a row is picked', async () => {
		const events: ActionEvent[] = [];
		const view: View = {
			title: 'Changes',
			blocks: [
				{
					type: 'list',
					id: 'files',
					items: [
						{ id: 'a', label: 'a.ts' },
						{ id: 'b', label: 'b.ts' },
					],
				},
			],
			actions: [
				{
					id: 'stage',
					label: 'Stage',
					selection: { blockId: 'files', required: true },
				},
			],
		};

		render(ViewRenderer, {
			view,
			host: host(),
			onAction: (event) => events.push(event),
		});

		const stage = screen.getByRole('button', { name: 'Stage' });
		expect(stage).toBeDisabled();

		await fireEvent.click(screen.getByRole('button', { name: /b\.ts/ }));
		expect(stage).toBeEnabled();

		await fireEvent.click(stage);
		expect(events).toEqual([
			{
				actionId: 'stage',
				selection: { blockId: 'files', itemId: 'b' },
				cancelled: false,
			},
		]);
	});

	it('runs intents on the host instead of sending them to the extension', async () => {
		const openUrl = vi.fn();
		const openFile = vi.fn();
		const onAction = vi.fn();
		const view: View = {
			title: 'Intents',
			blocks: [
				{
					type: 'list',
					id: 'files',
					items: [{ id: 'a', label: 'a.ts', path: 'src/a.ts' }],
					selectedId: 'a',
				},
			],
			actions: [
				{
					id: 'docs',
					label: 'Docs',
					intent: { kind: 'openUrl', url: 'https://example.com' },
				},
				{
					id: 'open',
					label: 'Open',
					intent: {
						kind: 'openFile',
						target: { kind: 'selection', blockId: 'files' },
					},
				},
			],
		};

		render(ViewRenderer, { view, host: host({ openUrl, openFile }), onAction });

		await fireEvent.click(screen.getByRole('button', { name: 'Docs' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Open' }));

		expect(openUrl).toHaveBeenCalledWith('https://example.com');
		expect(openFile).toHaveBeenCalledWith('src/a.ts', undefined, undefined);
		expect(onAction).not.toHaveBeenCalled();
	});
});
