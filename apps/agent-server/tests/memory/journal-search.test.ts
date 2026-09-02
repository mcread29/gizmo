import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	formatSearchResult,
	searchJournal,
	tokenize,
} from '../../src/memory/journal-search';
import { JournalStore } from '../../src/memory/journal-store';

function userEntry(id: string, text: string): SessionEntry {
	return {
		type: 'message',
		id,
		parentId: null,
		timestamp: new Date().toISOString(),
		message: { role: 'user', content: [{ type: 'text', text }] },
	} as SessionEntry;
}

describe('searchJournal', () => {
	let workspace: string;
	let store: JournalStore;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), 'gizmo-journal-search-'));
		store = new JournalStore(workspace);
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	it('ranks a line holding every term above lines holding one', async () => {
		await store.append(
			[
				userEntry('e1', 'we chose sqlite for the cache'),
				userEntry('e2', 'the cache is warmed at boot'),
				userEntry('e3', 'sqlite is fine'),
			],
			{ sessionId: 's1', trigger: 'session-end' },
		);

		const result = await searchJournal(store, 'sqlite cache');

		expect(result.hits[0]?.excerpt).toContain('we chose sqlite for the cache');
		expect(result.hits[0]?.segment).toBe('0001');
	});

	it('labels excerpts with the segment id and keeps surrounding lines', async () => {
		await store.append([userEntry('e1', 'first')], {
			sessionId: 's1',
			trigger: 'session-end',
		});
		await store.append([userEntry('e2', 'before\nneedle here\nafter')], {
			sessionId: 's2',
			trigger: 'session-end',
		});

		const result = await searchJournal(store, 'needle');

		expect(result.hits).toHaveLength(1);
		expect(result.hits[0]?.segment).toBe('0002');
		expect(result.hits[0]?.excerpt).toContain('before');
		expect(result.hits[0]?.excerpt).toContain('after');
		expect(formatSearchResult(result)).toContain('[segment 0002 line');
	});

	it('does not match the frontmatter', async () => {
		await store.append([userEntry('e1', 'nothing relevant')], {
			sessionId: 'sess',
			trigger: 'backfill',
		});

		expect((await searchJournal(store, 'backfill')).hits).toEqual([]);
		expect((await searchJournal(store, 'sess')).hits).toEqual([]);
	});

	it('caps hits per segment, in total, and by bytes', async () => {
		const noisy = Array.from({ length: 30 }, (_, n) =>
			userEntry(`n${n}`, `needle ${n}`),
		);
		await store.append(noisy, { sessionId: 'noisy', trigger: 'session-end' });
		await store.append([userEntry('q1', 'needle elsewhere')], {
			sessionId: 'quiet',
			trigger: 'session-end',
		});

		const perSegment = await searchJournal(store, 'needle', {
			context: 0,
			perSegment: 2,
		});
		expect(
			perSegment.hits.filter((hit) => hit.segment === '0001'),
		).toHaveLength(2);
		expect(perSegment.hits.some((hit) => hit.segment === '0002')).toBe(true);
		expect(perSegment.truncated).toBe(true);

		const total = await searchJournal(store, 'needle', {
			context: 0,
			perSegment: 50,
			maxHits: 5,
		});
		expect(total.hits).toHaveLength(5);

		const bytes = await searchJournal(store, 'needle', {
			context: 0,
			perSegment: 50,
			maxHits: 50,
			maxBytes: 100,
		});
		const used = bytes.hits.reduce(
			(sum, hit) => sum + Buffer.byteLength(hit.excerpt, 'utf8'),
			0,
		);
		expect(used).toBeLessThanOrEqual(100);
		expect(bytes.truncated).toBe(true);
		expect(formatSearchResult(bytes)).toContain('omitted');
	});

	it('clips very long lines around the match', async () => {
		const long = `${'a'.repeat(2000)} needle ${'b'.repeat(2000)}`;
		await store.append([userEntry('e1', long)], {
			sessionId: 's1',
			trigger: 'session-end',
		});

		const [hit] = (await searchJournal(store, 'needle', { context: 0 })).hits;
		expect(hit?.excerpt).toContain('needle');
		expect(hit?.excerpt.length).toBeLessThan(300);
	});

	it('reports an empty query and a miss distinctly', async () => {
		await store.append([userEntry('e1', 'content')], {
			sessionId: 's1',
			trigger: 'session-end',
		});

		expect(formatSearchResult(await searchJournal(store, ' a '))).toContain(
			'No search terms',
		);
		expect(formatSearchResult(await searchJournal(store, 'zzz'))).toContain(
			'No matches',
		);
	});
});

describe('tokenize', () => {
	it('lowercases, dedupes, and drops one-character words', () => {
		expect(tokenize('SQLite a sqlite  cache-warm')).toEqual([
			'sqlite',
			'cache-warm',
		]);
	});
});
