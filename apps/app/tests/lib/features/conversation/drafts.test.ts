import { beforeEach, describe, expect, it } from 'vitest';
import { DraftStore } from '../../../../src/lib/features/conversation/drafts.svelte.ts';

beforeEach(() => localStorage.clear());

describe('DraftStore', () => {
	it('keeps a separate draft per thread', () => {
		const drafts = new DraftStore();
		drafts.set('a', 'first');
		drafts.set('b', 'second');

		expect(drafts.get('a')).toBe('first');
		expect(drafts.get('b')).toBe('second');
		drafts.clear('a');
		expect(drafts.get('a')).toBe('');
	});

	it('carries text typed before a thread existed onto that thread', () => {
		const drafts = new DraftStore();
		drafts.set(undefined, 'typed while connecting');
		drafts.adopt('a');

		expect(drafts.get('a')).toBe('typed while connecting');
		expect(drafts.get(undefined)).toBe('');
	});

	it('never overwrites an existing thread draft when adopting', () => {
		const drafts = new DraftStore();
		drafts.set('a', 'mine');
		drafts.set(undefined, 'stray');
		drafts.adopt('a');

		expect(drafts.get('a')).toBe('mine');
	});

	it('survives a restart', () => {
		new DraftStore().set('a', 'remembered');

		expect(new DraftStore().get('a')).toBe('remembered');
	});
});
