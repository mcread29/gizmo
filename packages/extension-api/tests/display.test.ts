import { describe, expect, it } from 'vitest';
import { gizmoDisplay, gizmoView } from '../src/display';
import { readDisplayResult } from '../src/display-schema';

describe('gizmoDisplay', () => {
	const spec = {
		root: 'card',
		elements: { card: { type: 'Text' as const, props: { text: 'Result' } } },
	};
	it('validates the spec and isolates the returned data', () => {
		const result = gizmoDisplay(spec, { title: 'Hit' });
		expect(result.gizmoDisplay).toMatchObject({ version: 1, title: 'Hit' });
		expect('spec' in result.gizmoDisplay && result.gizmoDisplay.spec).toEqual(
			spec,
		);
		expect('spec' in result.gizmoDisplay && result.gizmoDisplay.spec).not.toBe(
			spec,
		);
		expect(() => gizmoDisplay({ ...spec, root: 'missing' })).toThrow(
			'Invalid display spec',
		);
	});
});

describe('gizmoView', () => {
	it('wraps a block view as a tool result and round-trips it', () => {
		const view = {
			title: 'Search',
			blocks: [{ type: 'text' as const, text: 'Three hits' }],
		};
		const result = gizmoView(view);
		expect(result.gizmoDisplay).toEqual({ version: 1, view });
		expect(readDisplayResult(result)).toEqual(result.gizmoDisplay);
	});
	it('rejects an invalid view', () => {
		expect(() =>
			gizmoView({ title: 'x', blocks: [{ type: 'bogus' } as never] }),
		).toThrow('Invalid view');
		expect(
			readDisplayResult({ gizmoDisplay: { version: 1, view: { blocks: 3 } } }),
		).toBeUndefined();
	});
});
