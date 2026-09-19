import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JournalIndex } from '../../src/memory/journal-index';
import { searchJournal, tokenize } from '../../src/memory/journal-search';
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

describe('JournalIndex', () => {
	let workspace: string;
	let data: string;
	let store: JournalStore;
	let index: JournalIndex;
	let previousDataDir: string | undefined;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), 'gizmo-index-work-'));
		data = await mkdtemp(join(tmpdir(), 'gizmo-index-data-'));
		previousDataDir = process.env.GIZMO_DATA_DIR;
		// The index lives in the data directory, never in the repository, so the
		// test has to redirect that rather than the workspace.
		process.env.GIZMO_DATA_DIR = data;
		store = new JournalStore(workspace);
		index = new JournalIndex(workspace);
	});

	afterEach(async () => {
		index.close();
		if (previousDataDir === undefined) delete process.env.GIZMO_DATA_DIR;
		else process.env.GIZMO_DATA_DIR = previousDataDir;
		await rm(workspace, { recursive: true, force: true });
		await rm(data, { recursive: true, force: true });
	});

	it('proposes only the segments whose bodies match', async () => {
		await store.append([userEntry('e1', 'we chose sqlite for the cache')], {
			sessionId: 's1',
			trigger: 'session-end',
		});
		await store.append([userEntry('e2', 'the tauri build was deleted')], {
			sessionId: 's2',
			trigger: 'session-end',
		});

		expect(await index.candidates(store, ['sqlite'])).toEqual(['0001-e1']);
		expect(await index.candidates(store, ['tauri'])).toEqual(['0002-e2']);
	});

	it('matches a term against the start of a longer word', async () => {
		await store.append([userEntry('e1', 'the vitest suite passes')], {
			sessionId: 's1',
			trigger: 'session-end',
		});

		expect(await index.candidates(store, ['vite'])).toEqual(['0001-e1']);
	});

	it('returns every segment holding any term, not just the best', async () => {
		await store.append([userEntry('e1', 'sqlite and cache together')], {
			sessionId: 's1',
			trigger: 'session-end',
		});
		await store.append([userEntry('e2', 'cache only')], {
			sessionId: 's2',
			trigger: 'session-end',
		});

		const proposed = await index.candidates(store, ['sqlite', 'cache']);
		expect(proposed?.sort()).toEqual(['0001-e1', '0002-e2']);
	});

	it('picks up a segment appended after the index was built', async () => {
		await store.append([userEntry('e1', 'the first segment')], {
			sessionId: 's1',
			trigger: 'session-end',
		});
		expect(await index.candidates(store, ['second'])).toEqual([]);

		await store.append([userEntry('e2', 'the second segment')], {
			sessionId: 's2',
			trigger: 'session-end',
		});

		expect(await index.candidates(store, ['second'])).toEqual(['0002-e2']);
	});

	it('reports nothing when no term matches', async () => {
		await store.append([userEntry('e1', 'nothing relevant here')], {
			sessionId: 's1',
			trigger: 'session-end',
		});

		expect(await index.candidates(store, ['sqlite'])).toEqual([]);
	});

	it('returns an empty list rather than every segment for no terms', async () => {
		await store.append([userEntry('e1', 'anything')], {
			sessionId: 's1',
			trigger: 'session-end',
		});

		expect(await index.candidates(store, [])).toEqual([]);
	});

	it('quotes terms so punctuation is not read as an FTS operator', async () => {
		await store.append([userEntry('e1', 'edit index.jsonl carefully')], {
			sessionId: 's1',
			trigger: 'session-end',
		});

		// An unquoted term containing a dot, or a bare OR/NOT, is a syntax error
		// in FTS5 -- which would surface as an unusable index rather than a hit.
		expect(await index.candidates(store, ['index.jsonl'])).toEqual(['0001-e1']);
		expect(await index.candidates(store, ['or'])).toEqual([]);
	});

	it('gives the same hits as searching without it', async () => {
		await store.append(
			[
				userEntry('e1', 'we chose sqlite for the cache'),
				userEntry('e2', 'the cache is warmed at boot'),
			],
			{ sessionId: 's1', trigger: 'session-end' },
		);
		await store.append([userEntry('e3', 'sqlite is fine')], {
			sessionId: 's2',
			trigger: 'session-end',
		});

		const scanned = await searchJournal(store, 'sqlite cache');
		const indexed = await searchJournal(store, 'sqlite cache', { index });

		expect(indexed.hits).toEqual(scanned.hits);
	});

	it('falls back to scanning when the index cannot be used', async () => {
		await store.append([userEntry('e1', 'we chose sqlite for the cache')], {
			sessionId: 's1',
			trigger: 'session-end',
		});
		const broken = {
			candidates: async () => undefined,
		} as unknown as JournalIndex;

		const result = await searchJournal(store, 'sqlite', { index: broken });

		expect(result.hits.length).toBeGreaterThan(0);
	});

	it('reads only the proposed segments', async () => {
		await store.append([userEntry('e1', 'we chose sqlite')], {
			sessionId: 's1',
			trigger: 'session-end',
		});
		await store.append([userEntry('e2', 'unrelated work')], {
			sessionId: 's2',
			trigger: 'session-end',
		});
		await index.candidates(store, tokenize('sqlite'));

		// Bound delegates rather than a Proxy: JournalStore keeps its state in
		// private fields, which a Proxy receiver cannot reach.
		const read: string[] = [];
		const watched = {
			list: () => store.list(),
			read: (id: string) => {
				read.push(id);
				return store.read(id);
			},
		} as unknown as JournalStore;

		await searchJournal(watched, 'sqlite', { index });

		expect(read).toEqual(['0001-e1']);
	});
});
