import { describe, expect, it } from 'vitest';
import {
	toolParameters,
	toolSummary,
} from '../../../../src/lib/features/conversation/tool-summary';

describe('toolSummary', () => {
	it('shows a single identifying argument on its own', () => {
		expect(toolSummary({ file: 'Assets/Player.cs' })).toBe('Assets/Player.cs');
		expect(toolSummary({ command: 'build_status' })).toBe('build_status');
	});

	it('leads with the identifying argument when there are several', () => {
		expect(toolSummary({ tail: 50, command: 'editor_play' })).toBe(
			'command=editor_play · tail=50',
		);
	});

	it('summarises arrays by size rather than dumping them', () => {
		expect(toolSummary({ commands: ['a', 'b', 'c'] })).toBe('commands=3 items');
	});

	it('ignores empty arguments and inputs with nothing to say', () => {
		expect(toolSummary({})).toBeUndefined();
		expect(toolSummary(undefined)).toBeUndefined();
		expect(toolSummary({ query: '', filter: null })).toBeUndefined();
	});

	it('truncates rather than wrapping the header', () => {
		const summary = toolSummary({ query: 'x'.repeat(200) });

		expect(summary).toHaveLength(72);
		expect(summary?.endsWith('…')).toBe(true);
	});

	it('lists every argument in full for the expanded card', () => {
		expect(toolParameters({ file: 'a.cs', lines: [1, 2] })).toEqual([
			['file', 'a.cs'],
			['lines', '[1,2]'],
		]);
	});
});
