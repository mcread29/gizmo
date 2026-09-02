import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	entriesSince,
	JournalStore,
	journalDir,
} from '../../src/memory/journal-store';

function userEntry(id: string, text: string): SessionEntry {
	return {
		type: 'message',
		id,
		parentId: null,
		timestamp: new Date().toISOString(),
		message: { role: 'user', content: [{ type: 'text', text }] },
	} as SessionEntry;
}

describe('JournalStore', () => {
	let workspace: string;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), 'gizmo-journal-'));
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	it('numbers segments and writes the body beside a frontmatter header', async () => {
		const store = new JournalStore(workspace);

		const first = await store.append([userEntry('e1', 'hello')], {
			sessionId: 'abc123',
			trigger: 'compaction',
		});
		const second = await store.append([userEntry('e2', 'again')], {
			sessionId: 'abc123',
			trigger: 'session-end',
		});

		expect(first[0]?.id).toBe('0001');
		expect(second[0]?.id).toBe('0002');
		const file = await readFile(
			join(journalDir(workspace), '0001-abc123.md'),
			'utf8',
		);
		expect(file).toContain('id: "0001"');
		expect(file).toContain('trigger: compaction');
		expect(file).toContain('## user');
		expect(file).toContain('hello');
	});

	it('ignores spans that carry no messages', async () => {
		const store = new JournalStore(workspace);

		const meta = await store.append(
			[
				{
					type: 'compaction',
					id: 'c1',
					parentId: null,
					timestamp: new Date().toISOString(),
					summary: 'summarized',
					firstKeptEntryId: 'e9',
					tokensBefore: 10,
				} as SessionEntry,
			],
			{ sessionId: 'abc123', trigger: 'compaction' },
		);

		expect(meta).toEqual([]);
		expect(await store.list()).toEqual([]);
	});

	it('resumes after the newest already-journaled entry on the branch', async () => {
		const store = new JournalStore(workspace);
		const branch = [userEntry('e1', 'one'), userEntry('e2', 'two')];
		await store.append(branch, { sessionId: 'aaa', trigger: 'compaction' });

		branch.push(userEntry('e3', 'three'));
		expect(await store.resumeAfter(branch)).toBe('e2');
	});

	it('has no resume point on a branch it has never seen', async () => {
		const store = new JournalStore(workspace);
		await store.append([userEntry('e1', 'one')], {
			sessionId: 'aaa',
			trigger: 'compaction',
		});

		expect(await store.resumeAfter([userEntry('z9', 'other')])).toBeUndefined();
	});

	/**
	 * Forking copies every entry into a new session file but keeps the original
	 * entry ids, so matching on ids rather than session ids is what stops the
	 * inherited history from being journaled a second time.
	 */
	it('does not re-journal history inherited by a fork', async () => {
		const store = new JournalStore(workspace);
		const parentBranch = [userEntry('e1', 'one'), userEntry('e2', 'two')];
		await store.append(parentBranch, {
			sessionId: 'parent',
			trigger: 'compaction',
		});

		const forkBranch = [...parentBranch, userEntry('e3', 'three')];
		expect(await store.resumeAfter(forkBranch)).toBe('e2');
	});

	/**
	 * A long span becomes several segments. Every one of them is indexed, so
	 * the resume point is the end of the last chunk and a second append of the
	 * same branch has nothing left to write.
	 */
	it('splits a long span into several segments and resumes after the last', async () => {
		const store = new JournalStore(workspace);
		const branch = Array.from({ length: 12 }, (_, n) =>
			userEntry(`e${n}`, 'x'.repeat(10_000)),
		);

		const written = await store.append(branch, {
			sessionId: 'long',
			trigger: 'backfill',
		});

		expect(written.length).toBeGreaterThan(1);
		expect(written.map(({ id }) => id)).toEqual(
			written.map((_, n) => String(n + 1).padStart(4, '0')),
		);
		for (const meta of written) expect(meta.bytes).toBeLessThanOrEqual(40_000);
		expect(written.at(-1)?.lastEntryId).toBe('e11');
		expect(await store.resumeAfter(branch)).toBe('e11');
		expect(await store.list()).toHaveLength(written.length);
	});

	it('reads a segment back by id', async () => {
		const store = new JournalStore(workspace);
		await store.append([userEntry('e1', 'recorded')], {
			sessionId: 'abc',
			trigger: 'compaction',
		});

		expect(await store.read('0001')).toContain('recorded');
		expect(await store.read('0099')).toBeUndefined();
	});

	it('survives a torn trailing index line', async () => {
		const store = new JournalStore(workspace);
		await store.append([userEntry('e1', 'kept')], {
			sessionId: 'abc',
			trigger: 'compaction',
		});
		const { appendFile } = await import('node:fs/promises');
		await appendFile(join(journalDir(workspace), 'index.jsonl'), '{"id":"00');

		expect(await store.list()).toHaveLength(1);
	});
});

describe('entriesSince', () => {
	const entries = [
		userEntry('e1', 'a'),
		userEntry('e2', 'b'),
		userEntry('e3', 'c'),
	];

	it('returns everything when nothing has been journaled', () => {
		expect(entriesSince(entries, undefined)).toHaveLength(3);
	});

	it('returns only what follows the last journaled entry', () => {
		expect(entriesSince(entries, 'e1').map(({ id }) => id)).toEqual([
			'e2',
			'e3',
		]);
	});

	it('returns everything when the marker is not on this branch', () => {
		expect(entriesSince(entries, 'missing')).toHaveLength(3);
	});
});
