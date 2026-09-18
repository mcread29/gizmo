import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { searchDigests } from '../../src/memory/digest-search';
import type { JournalDigest } from '../../src/memory/journal-digest';
import {
	formatSearchResult,
	searchJournal,
	tokenize,
} from '../../src/memory/journal-search';
import { JournalStore } from '../../src/memory/journal-store';

function digest(overrides: Partial<JournalDigest> = {}): JournalDigest {
	return {
		segment: '0001-aaaaaaaa',
		at: new Date().toISOString(),
		model: 'test/model',
		summary: '',
		decisions: [],
		files: [],
		errors: [],
		outcome: 'shipped',
		...overrides,
	};
}

function userEntry(id: string, text: string): SessionEntry {
	return {
		type: 'message',
		id,
		parentId: null,
		timestamp: new Date().toISOString(),
		message: { role: 'user', content: [{ type: 'text', text }] },
	} as SessionEntry;
}

describe('searchDigests', () => {
	it('ranks a digest covering both terms above one repeating a single term', () => {
		const covers = digest({
			segment: '0001-aaaaaaaa',
			summary: 'switched the cache to sqlite',
		});
		const repeats = digest({
			segment: '0002-bbbbbbbb',
			summary: 'cache, cache and more cache',
			decisions: ['the cache is warmed at boot'],
			errors: ['cache miss storm'],
		});
		const ranked = searchDigests([covers, repeats], tokenize('sqlite cache'));
		expect(ranked.map((hit) => hit.segment)).toEqual([
			'0001-aaaaaaaa',
			'0002-bbbbbbbb',
		]);
	});

	it('weights a decision above a filename mentioning the same term', () => {
		const decided = digest({
			segment: '0001-aaaaaaaa',
			decisions: ['never write to the journal index directly'],
		});
		const mentioned = digest({
			segment: '0002-bbbbbbbb',
			files: ['src/journal/index.ts'],
		});
		const ranked = searchDigests([decided, mentioned], tokenize('journal'));
		expect(ranked[0]?.segment).toBe('0001-aaaaaaaa');
		expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
	});

	it('prefers the later segment when two digests score the same', () => {
		const older = digest({ segment: '0001-aaaaaaaa', summary: 'chose sqlite' });
		const newer = digest({ segment: '0009-bbbbbbbb', summary: 'chose sqlite' });
		const ranked = searchDigests([older, newer], tokenize('sqlite'));
		expect(ranked[0]?.segment).toBe('0009-bbbbbbbb');
	});

	it('matches an outcome so abandoned work can be found directly', () => {
		const ranked = searchDigests(
			[digest({ summary: 'tried the worker pool', outcome: 'abandoned' })],
			tokenize('abandoned'),
		);
		expect(ranked).toHaveLength(1);
	});

	it('returns nothing for a query that matches no field', () => {
		expect(searchDigests([digest({ summary: 'a' })], tokenize('zzz'))).toEqual(
			[],
		);
	});
});

describe('searchJournal with digests', () => {
	let workspace: string;
	let store: JournalStore;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), 'gizmo-digest-search-'));
		store = new JournalStore(workspace);
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	it('reports conclusions above the excerpts behind them', async () => {
		await store.append(
			[userEntry('e1', 'we should try sqlite for the cache')],
			{ sessionId: 's1', trigger: 'session-end' },
		);
		const result = await searchJournal(store, 'sqlite', {
			digests: [digest({ summary: 'settled on sqlite for the cache' })],
		});

		expect(result.digests).toHaveLength(1);
		expect(result.hits.length).toBeGreaterThan(0);
		const text = formatSearchResult(result);
		expect(text.indexOf('What earlier sessions concluded')).toBeLessThan(
			text.indexOf('Matching excerpts'),
		);
		expect(text).toContain('settled on sqlite');
	});

	/**
	 * The point of keeping the segment scan is that an undigested project is
	 * not a silent hole in memory. Digesting lags journaling by a model call,
	 * so the most recent segment is routinely the undigested one.
	 */
	it('still searches segments when nothing has been digested', async () => {
		await store.append([userEntry('e1', 'we chose sqlite')], {
			sessionId: 's1',
			trigger: 'session-end',
		});
		const result = await searchJournal(store, 'sqlite');
		expect(result.digests).toEqual([]);
		expect(result.hits.length).toBeGreaterThan(0);
		expect(formatSearchResult(result)).not.toContain('Matching excerpts');
	});

	it('surfaces a digest hit for a segment whose body never says the word', async () => {
		await store.append(
			[userEntry('e1', 'switched the store over, tests pass')],
			{ sessionId: 's1', trigger: 'session-end' },
		);
		const result = await searchJournal(store, 'sqlite', {
			digests: [digest({ decisions: ['use sqlite, not a flat file'] })],
		});
		expect(result.hits).toEqual([]);
		expect(result.digests).toHaveLength(1);
		expect(formatSearchResult(result)).toContain('use sqlite, not a flat file');
	});

	it('caps the digests reported and says it truncated', async () => {
		const many = Array.from({ length: 9 }, (_, index) =>
			digest({
				segment: `000${index + 1}-aaaaaaaa`,
				summary: 'sqlite again',
			}),
		);
		const result = await searchJournal(store, 'sqlite', { digests: many });
		expect(result.digests).toHaveLength(5);
		expect(result.truncated).toBe(true);
	});
});
