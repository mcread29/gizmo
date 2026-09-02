import { describe, expect, it } from 'vitest';
import { WorkspaceReorder } from '../../../../src/lib/features/sessions/sidebar-reorder.svelte';

describe('WorkspaceReorder.move', () => {
	function setup(paths = ['a', 'b', 'c']) {
		const committed: string[][] = [];
		const reorder = new WorkspaceReorder(
			() => paths,
			(next) => committed.push(next),
		);
		return { reorder, committed };
	}

	it('moves a workspace up', () => {
		const { reorder, committed } = setup();

		expect(reorder.move('b', -1)).toBe(true);
		expect(committed).toEqual([['b', 'a', 'c']]);
	});

	it('moves a workspace down', () => {
		const { reorder, committed } = setup();

		expect(reorder.move('b', 1)).toBe(true);
		expect(committed).toEqual([['a', 'c', 'b']]);
	});

	it('refuses to move past either end, and commits nothing', () => {
		const { reorder, committed } = setup();

		expect(reorder.move('a', -1)).toBe(false);
		expect(reorder.move('c', 1)).toBe(false);
		expect(committed).toEqual([]);
	});

	it('ignores a workspace it does not know', () => {
		const { reorder, committed } = setup();

		expect(reorder.move('missing', 1)).toBe(false);
		expect(committed).toEqual([]);
	});
});
