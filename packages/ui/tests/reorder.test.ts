import { describe, expect, it } from 'vitest';
import { applyOrder, dropEdge, reorderByDrop } from '../src/reorder';

describe('reorderByDrop', () => {
	const items = ['a', 'b', 'c', 'd'];

	it('moves an item down past its target', () => {
		expect(reorderByDrop(items, 0, 2, 'after')).toEqual(['b', 'c', 'a', 'd']);
	});

	it('moves an item up before its target', () => {
		expect(reorderByDrop(items, 3, 1, 'before')).toEqual(['a', 'd', 'b', 'c']);
	});

	it('is a no-op when dropped beside itself', () => {
		expect(reorderByDrop(items, 1, 1, 'before')).toEqual(items);
		expect(reorderByDrop(items, 1, 0, 'after')).toEqual(items);
	});

	it('ignores out-of-range indexes', () => {
		expect(reorderByDrop(items, -1, 2, 'before')).toEqual(items);
		expect(reorderByDrop(items, 0, 9, 'before')).toEqual(items);
	});
});

describe('dropEdge', () => {
	const target = {
		getBoundingClientRect: () => ({
			top: 100,
			left: 0,
			height: 40,
			width: 200,
		}),
	} as unknown as Element;

	it('splits the target on its midpoint', () => {
		expect(dropEdge({ clientX: 0, clientY: 110 }, target, 'y')).toBe('before');
		expect(dropEdge({ clientX: 0, clientY: 130 }, target, 'y')).toBe('after');
		expect(dropEdge({ clientX: 150, clientY: 0 }, target, 'x')).toBe('after');
	});
});

describe('applyOrder', () => {
	it('sorts known keys first and keeps new items in place after them', () => {
		const items = [{ id: 'x' }, { id: 'a' }, { id: 'b' }, { id: 'y' }];
		expect(
			applyOrder(items, ['b', 'a'], ({ id }) => id).map(({ id }) => id),
		).toEqual(['b', 'a', 'x', 'y']);
	});
});
