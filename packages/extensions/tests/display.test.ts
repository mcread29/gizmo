import { describe, expect, it } from 'vitest';
import { gizmoDisplay } from '../src/display';

describe('gizmoDisplay', () => {
	const spec = {
		root: 'hit',
		elements: { hit: { type: 'Hit', props: { title: 'Result' } } },
	};
	it('validates an extension catalog before returning tool details', () => {
		expect(
			gizmoDisplay(spec, { catalog: 'search/results' }).gizmoDisplay.spec,
		).toEqual(spec);
		expect(() => gizmoDisplay(spec, { catalog: 'invalid' })).toThrow(
			'Invalid display envelope',
		);
		expect(() =>
			gizmoDisplay({ ...spec, root: 'missing' }, { catalog: 'search/results' }),
		).toThrow('Invalid display catalog spec');
	});
	it('applies the extension prop schema hook and isolates returned data', () => {
		expect(() =>
			gizmoDisplay(spec, {
				catalog: 'search/results',
				validateNode: () => false,
			}),
		).toThrow('Invalid display catalog spec');
		const result = gizmoDisplay(spec, {
			catalog: 'search/results',
			validateNode: (node) => typeof node.props.title === 'string',
		});
		expect(result.gizmoDisplay.spec).not.toBe(spec);
	});
});
