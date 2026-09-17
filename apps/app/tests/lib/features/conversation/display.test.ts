import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { DisplaySpec, ToolCallView } from '@gizmo/protocol';
import ToolCallCard from '../../../../src/lib/features/conversation/ToolCallCard.svelte';

vi.mock('../../../../src/lib/extensions/registry.svelte', () => ({
	webExtensions: () => [],
	extension: () => undefined,
}));

const spec = {
	root: 'stack',
	elements: {
		stack: {
			type: 'Stack',
			props: {},
			children: ['heading', 'card', 'list', 'table', 'metric', 'divider'],
		},
		heading: { type: 'Heading', props: { text: 'Overview', level: 1 } },
		card: { type: 'Card', props: { title: 'Details' }, children: ['text'] },
		text: { type: 'Text', props: { text: 'Plain content' } },
		list: { type: 'List', props: { items: ['First', 'First', 'Second'] } },
		table: {
			type: 'Table',
			props: { columns: ['Name', 'Value'], rows: [['Alpha', '42']] },
		},
		metric: {
			type: 'Metric',
			props: { label: 'Total', value: '42', description: 'All items' },
		},
		divider: { type: 'Divider', props: {} },
	},
} satisfies DisplaySpec;
const result = { gizmoDisplay: { version: 1, title: 'Report', spec } };
function tool(overrides: Partial<ToolCallView> = {}): ToolCallView {
	return {
		id: 'display-1',
		name: 'display',
		status: 'complete',
		statusText: 'Completed',
		input: { spec, secretParameter: 'DO NOT DUMP' },
		result,
		...overrides,
	};
}

describe('inline display tools', () => {
	it('renders every catalog component outside collapsed details', () => {
		const { container } = render(ToolCallCard, { tool: tool() });
		expect(container.querySelector('details')).not.toHaveAttribute('open');
		expect(
			container.querySelector('[data-ui="display-result"]')?.closest('details'),
		).toBeNull();
		expect(
			screen.getByRole('heading', { name: 'Overview', level: 1 }),
		).toBeVisible();
		expect(screen.getByRole('region', { name: 'Details' })).toHaveTextContent(
			'Plain content',
		);
		expect(screen.getAllByRole('listitem')).toHaveLength(3);
		expect(screen.getByRole('table')).toHaveTextContent('Alpha');
		expect(screen.getByRole('columnheader', { name: 'Value' })).toBeVisible();
		expect(screen.getByText('All items')).toBeVisible();
		expect(screen.getByRole('separator')).toBeVisible();
		expect(container.textContent).not.toContain('DO NOT DUMP');
	});

	it('keeps partial output visible while running, collapsed, and after completion', async () => {
		const { container, rerender } = render(ToolCallCard, {
			tool: tool({ status: 'running', statusText: 'Waiting for input' }),
			active: true,
			collapseToken: 1,
		});
		expect(screen.getByText('Plain content')).toBeVisible();
		await rerender({
			tool: tool({ status: 'running', statusText: 'Waiting for input' }),
			active: true,
			collapseToken: 2,
		});
		expect(container.querySelector('details')).not.toHaveAttribute('open');
		expect(screen.getByText('Plain content')).toBeVisible();
		await rerender({
			tool: tool({
				result: { ...result, response: { status: 'submitted', value: false } },
			}),
			active: false,
		});
		expect(screen.getByText('Plain content')).toBeVisible();
		expect(
			container.querySelectorAll('[data-ui="display-result"]'),
		).toHaveLength(1);
	});

	it.each([1, 2, 3] as const)('uses heading level %s', (level) => {
		render(ToolCallCard, {
			tool: tool({
				result: {
					gizmoDisplay: {
						version: 1,
						spec: {
							root: 'h',
							elements: {
								h: { type: 'Heading', props: { text: 'Title', level } },
							},
						},
					},
				},
			}),
		});
		expect(screen.getByRole('heading', { name: 'Title', level })).toBeVisible();
	});

	it('escapes malicious text rather than creating markup', () => {
		const malicious = '<img src=x onerror=alert(1)><script>alert(1)</script>';
		const { container } = render(ToolCallCard, {
			tool: tool({
				result: {
					gizmoDisplay: {
						version: 1,
						title: malicious,
						spec: {
							root: 't',
							elements: { t: { type: 'Text', props: { text: malicious } } },
						},
					},
				},
			}),
		});
		expect(screen.getAllByText(malicious)).toHaveLength(3);
		expect(container.querySelector('img, script')).toBeNull();
	});

	it.each([
		{ gizmoDisplay: { version: 2, spec } },
		{ gizmoDisplay: { version: 1, spec: { root: 'missing', elements: {} } } },
		{
			gizmoDisplay: {
				version: 1,
				spec: { root: 'x', elements: { x: { type: 'Button', props: {} } } },
			},
		},
		{
			gizmoDisplay: {
				version: 1,
				spec: {
					root: 'x',
					elements: {
						x: { type: 'Text', props: { text: { $state: '/secret' } } },
					},
				},
			},
		},
		{ error: 'Display failed' },
	])('falls back to normal output for invalid results', async (invalid) => {
		const { container } = render(ToolCallCard, {
			tool: tool({ result: invalid }),
		});
		expect(container.querySelector('[data-ui="display-result"]')).toBeNull();
		await fireEvent.click(container.querySelector('summary')!);
		expect(
			container.querySelector('[data-ui="structured-result"]'),
		).not.toBeNull();
		expect(container.querySelector('[data-ui="tool-parameters"]')).toBeNull();
	});

	it('renders a display envelope from any tool, not only display', () => {
		// An extension tool may describe its card as data too.
		const { container } = render(ToolCallCard, {
			tool: tool({ name: 'search', result: { hits: 3, ...result } }),
		});
		expect(
			container.querySelector('[data-ui="display-result"]'),
		).not.toBeNull();
		expect(
			render(ToolCallCard, {
				tool: tool({ name: 'bash', result: { stdout: 'ok' } }),
			}).container.querySelector('[data-ui="display-result"]'),
		).toBeNull();
	});

	it('falls back to the normal result when no extension provides the catalog', async () => {
		const { container } = render(ToolCallCard, {
			tool: tool({
				name: 'search',
				result: {
					gizmoDisplay: {
						version: 1,
						catalog: 'search-and-scrape/results',
						spec: { root: 'r', elements: { r: { type: 'Hit', props: {} } } },
					},
				},
			}),
		});
		expect(container.querySelector('[data-ui="display-result"]')).toBeNull();
		await fireEvent.click(container.querySelector('summary')!);
		expect(
			container.querySelector('[data-ui="structured-result"]'),
		).toHaveTextContent('search-and-scrape/results');
	});

	it('does not replace errors with a display', () => {
		const { container } = render(ToolCallCard, {
			tool: tool({ status: 'error', result: { error: 'Display failed' } }),
		});
		expect(screen.getByText('Display failed')).toBeInTheDocument();
		expect(container.querySelector('[data-ui="display-result"]')).toBeNull();
	});
});
