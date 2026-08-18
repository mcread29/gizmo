import type { SessionTree, SessionTreeEntry } from '@unity-agent/protocol';
import { describe, expect, it } from 'vitest';
import { activePath, treeRows } from './session-tree';

function entry(
	id: string,
	parentId: string | null,
	kind: SessionTreeEntry['kind'],
	summary = id,
	label?: string,
): SessionTreeEntry {
	return {
		id,
		parentId,
		kind,
		summary,
		createdAt: 0,
		...(label ? { label } : {}),
	};
}

/*
 *  u1 ── a1 ── t1 ─┬─ u2   (abandoned)
 *                  └─ u3   (current leaf, labelled)
 */
const tree: SessionTree = {
	entries: [
		entry('u1', null, 'user', 'first prompt'),
		entry('a1', 'u1', 'assistant', 'first reply'),
		entry('t1', 'a1', 'tool', 'unity_status'),
		entry('u2', 't1', 'user', 'abandoned follow-up'),
		entry('u3', 't1', 'user', 'kept follow-up', 'good run'),
	],
	leafId: 'u3',
};

describe('activePath', () => {
	it('walks the leaf back to the root', () => {
		expect([...activePath(tree)]).toEqual(['u3', 't1', 'a1', 'u1']);
	});
});

describe('treeRows', () => {
	it('hides tool entries but keeps their children attached', () => {
		const rows = treeRows(tree, { filter: 'default' });
		expect(rows.map((row) => row.entry.id)).toEqual(['u1', 'a1', 'u2', 'u3']);
		expect(
			rows.filter((row) => row.depth > 0).map((row) => row.entry.id),
		).toEqual(['u2', 'u3']);
	});

	it('marks the active path and the leaf', () => {
		const rows = treeRows(tree, { filter: 'all' });
		expect(rows.filter((row) => row.active).map((row) => row.entry.id)).toEqual(
			['u1', 'a1', 't1', 'u3'],
		);
		expect(rows.find((row) => row.leaf)?.entry.id).toBe('u3');
	});

	it('counts siblings so a branch point is visible', () => {
		const branch = treeRows(tree, { filter: 'all' }).find(
			(row) => row.entry.id === 'u2',
		);
		expect(branch).toMatchObject({ branchIndex: 0, branchCount: 2 });
	});

	it('keeps labelled entries in every filter, and only those in labelled-only', () => {
		expect(
			treeRows(tree, { filter: 'user-only' }).map((row) => row.entry.id),
		).toEqual(['u1', 'u2', 'u3']);
		expect(
			treeRows(tree, { filter: 'labeled-only' }).map((row) => row.entry.id),
		).toEqual(['u3']);
	});

	it('keeps the ancestors of a search hit', () => {
		expect(
			treeRows(tree, { filter: 'all', search: 'abandoned' }).map(
				(row) => row.entry.id,
			),
		).toEqual(['u1', 'a1', 't1', 'u2']);
	});

	it('folds a branch away without losing the rest', () => {
		expect(
			treeRows(tree, { filter: 'all', folded: new Set(['t1']) }).map(
				(row) => row.entry.id,
			),
		).toEqual(['u1', 'a1', 't1']);
	});
});
