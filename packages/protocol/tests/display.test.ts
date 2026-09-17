import { describe, expect, it } from 'vitest';
import {
	parseDisplaySpec,
	readDisplayResult,
	type DisplayElement,
} from '../src/display';

const spec = (node: unknown = { type: 'Text', props: { text: 'Hello' } }) => ({
	root: 'root',
	elements: { root: node },
});

describe('display validation', () => {
	it.each<DisplayElement>([
		{ type: 'Heading', props: { text: 'Title', level: 2 } },
		{ type: 'Text', props: { text: '<b>literal text, not HTML</b>' } },
		{ type: 'Card', props: { title: 'Card' } },
		{ type: 'Stack', props: {} },
		{ type: 'List', props: { items: ['one'] } },
		{ type: 'Table', props: { columns: ['Name'], rows: [['A']] } },
		{
			type: 'Metric',
			props: { label: 'Count', value: '42', description: 'Today' },
		},
		{ type: 'Divider', props: {} },
	])('accepts static $type', (node) => {
		expect(parseDisplaySpec(spec(node))).toEqual(spec(node));
	});

	it.each([
		null,
		{},
		{ type: 'HTML', props: { html: '<script/>' } },
		{ type: 'Text', props: { text: 'Hi', onClick: 'run' } },
		{ type: 'Text', props: { text: { $expr: 'state.value' } } },
		{ type: 'Text', props: { text: 'Hi' }, action: 'run' },
		{ type: 'Heading', props: { text: 'Hi', level: 4 } },
		{ type: 'Metric', props: { label: 'Count', value: 42 } },
		{ type: 'Table', props: { columns: ['A', 'B'], rows: [['only one']] } },
		{ type: 'Text', props: { text: 'x'.repeat(4001) } },
	])('rejects invalid elements %#', (node) => {
		expect(parseDisplaySpec(spec(node))).toBeUndefined();
	});

	it('rejects broken trees, leaf children, disconnected nodes, cycles and shared children', () => {
		const leaf = { type: 'Text', props: { text: 'hi' } };
		const stack = (children: string[]) => ({
			type: 'Stack',
			props: {},
			children,
		});
		for (const elements of [
			{ root: stack(['missing']) },
			{ root: stack(['root']) },
			{ root: leaf, other: leaf },
			{ root: { ...leaf, children: ['other'] }, other: leaf },
			{ root: stack(['a', 'b']), a: stack(['c']), b: stack(['c']), c: leaf },
			{ root: stack(['a', 'a']), a: leaf },
		])
			expect(parseDisplaySpec({ root: 'root', elements })).toBeUndefined();
		expect(
			parseDisplaySpec({ root: 'absent', elements: { root: leaf } }),
		).toBeUndefined();
	});

	it('bounds node count, depth and aggregate text', () => {
		const chain = (count: number) => ({
			root: 'n0',
			elements: Object.fromEntries(
				Array.from({ length: count }, (_, i) => [
					`n${i}`,
					{
						type: 'Stack',
						props: {},
						children: i + 1 < count ? [`n${i + 1}`] : [],
					},
				]),
			),
		});
		expect(parseDisplaySpec(chain(16))).toBeDefined();
		expect(parseDisplaySpec(chain(17))).toBeUndefined();
		expect(parseDisplaySpec(chain(101))).toBeUndefined();
		expect(
			parseDisplaySpec(
				spec({
					type: 'List',
					props: { items: Array(100).fill('x'.repeat(4000)) },
				}),
			),
		).toBeUndefined();
	});

	it('rejects unsafe identifiers, accessors, and cyclic JavaScript data without throwing', () => {
		expect(
			parseDisplaySpec(
				JSON.parse(
					'{"root":"__proto__","elements":{"__proto__":{"type":"Stack","props":{}}}}',
				),
			),
		).toBeUndefined();
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		expect(parseDisplaySpec(cyclic)).toBeUndefined();
		const getter = Object.defineProperty({}, 'root', {
			enumerable: true,
			get() {
				throw new Error('not JSON');
			},
		});
		expect(parseDisplaySpec(getter)).toBeUndefined();
	});

	it('round-trips a near-limit spec with a full-length input response', () => {
		const large = spec({
			type: 'List',
			props: { items: Array(15).fill('x'.repeat(4000)) },
		});
		const parsed = parseDisplaySpec(large);
		expect(parsed).toBeDefined();
		expect(
			readDisplayResult({
				gizmoDisplay: { version: 1, title: 'Report', spec: parsed },
				response: { status: 'submitted', value: 'y'.repeat(4000) },
			})?.spec,
		).toEqual(parsed);
	});

	it('returns a detached validated spec', () => {
		const input = spec();
		const parsed = parseDisplaySpec(input);
		expect(parsed).toEqual(input);
		expect(parsed).not.toBe(input);
	});

	it('reads normalized details and checks version, title, tree and response', () => {
		const gizmoDisplay = { version: 1, title: 'Report', spec: spec() };
		expect(readDisplayResult({ gizmoDisplay })).toEqual(gizmoDisplay);
		expect(
			readDisplayResult({
				gizmoDisplay,
				response: { status: 'submitted', value: false },
			}),
		).toEqual(gizmoDisplay);
		expect(
			readDisplayResult({ gizmoDisplay, response: { status: 'cancelled' } }),
		).toEqual(gizmoDisplay);
		for (const value of [
			undefined,
			'bad',
			{ gizmoDisplay: { ...gizmoDisplay, version: 2 } },
			{ gizmoDisplay: { ...gizmoDisplay, title: 1 } },
			{ gizmoDisplay, response: { status: 'submitted', value: {} } },
			{ gizmoDisplay: { ...gizmoDisplay, spec: {} } },
		]) {
			expect(readDisplayResult(value)).toBeUndefined();
		}
	});

	it('accepts an extension catalog envelope with unknown element types', () => {
		const details = {
			gizmoDisplay: {
				version: 1,
				catalog: 'search-and-scrape/results',
				spec: {
					root: 'list',
					elements: {
						list: {
							type: 'ResultList',
							props: { query: 'x' },
							children: ['r1'],
						},
						r1: { type: 'Result', props: { url: 'https://a', score: 0.5 } },
					},
				},
			},
		};
		expect(readDisplayResult(details)?.spec.root).toBe('list');
		// Still one rooted tree: a cycle is rejected even for a custom catalog.
		details.gizmoDisplay.spec.elements.r1 = {
			type: 'Result',
			props: {},
			children: ['list'],
		} as never;
		expect(readDisplayResult(details)).toBeUndefined();
		// The catalog id must name an extension and a registry.
		expect(
			readDisplayResult({
				gizmoDisplay: { version: 1, catalog: 'nope', spec: spec() },
			}),
		).toBeUndefined();
		// Built-in specs never carry unknown types.
		expect(
			readDisplayResult({
				gizmoDisplay: { version: 1, spec: spec({ type: 'Result', props: {} }) },
			}),
		).toBeUndefined();
	});
});
