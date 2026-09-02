import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	JournalRecorder,
	takeUntil,
	type JournaledSession,
} from '../../src/memory/journal-recorder';
import { JournalStore } from '../../src/memory/journal-store';

function userEntry(id: string, text = 'hello'): SessionEntry {
	return {
		type: 'message',
		id,
		parentId: null,
		timestamp: new Date().toISOString(),
		message: { role: 'user', content: [{ type: 'text', text }] },
	} as SessionEntry;
}

function stubManager(
	sessionId: string,
	branch: SessionEntry[],
): JournaledSession {
	return { getSessionId: () => sessionId, getBranch: () => branch };
}

describe('JournalRecorder', () => {
	let workspace: string;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), 'gizmo-recorder-'));
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	it('records each span once across repeated boundaries', async () => {
		const store = new JournalStore(workspace);
		const recorder = new JournalRecorder(store);
		const branch = [userEntry('e1'), userEntry('e2')];

		const first = await recorder.record(stubManager('s1', branch), {
			trigger: 'compaction',
		});
		branch.push(userEntry('e3'));
		const second = await recorder.record(stubManager('s1', branch), {
			trigger: 'session-end',
		});

		expect(first.at(-1)?.lastEntryId).toBe('e2');
		expect(second.at(-1)?.lastEntryId).toBe('e3');
		expect(second.at(-1)?.messages).toBe(1);
	});

	it('stops at the entry the live context resumes from', async () => {
		const store = new JournalStore(workspace);
		const recorder = new JournalRecorder(store);
		const branch = [userEntry('e1'), userEntry('e2'), userEntry('e3')];

		const meta = await recorder.record(stubManager('s1', branch), {
			trigger: 'compaction',
			until: 'e3',
		});

		expect(meta.at(-1)?.lastEntryId).toBe('e2');
		expect(await store.resumeAfter(branch)).toBe('e2');
	});

	it('records only what a fork adds to its inherited history', async () => {
		const store = new JournalStore(workspace);
		const recorder = new JournalRecorder(store);
		const branch = [userEntry('e1'), userEntry('e2')];
		await recorder.record(stubManager('parent', branch), {
			trigger: 'compaction',
		});

		// A fork keeps the entry ids but gets a fresh session id.
		const forked = [...branch, userEntry('e3')];
		const meta = await recorder.record(stubManager('fork', forked), {
			trigger: 'session-end',
		});

		expect(meta).toHaveLength(1);
		expect(meta[0]?.firstEntryId).toBe('e3');
	});

	it('does nothing when there is nothing new', async () => {
		const store = new JournalStore(workspace);
		const recorder = new JournalRecorder(store);
		const branch = [userEntry('e1')];
		await recorder.record(stubManager('s1', branch), { trigger: 'compaction' });

		const again = await recorder.record(stubManager('s1', branch), {
			trigger: 'session-end',
		});

		expect(again).toEqual([]);
	});

	it('holds a small tail back until it crosses the threshold', async () => {
		const store = new JournalStore(workspace);
		const recorder = new JournalRecorder(store, { thresholdBytes: 500 });
		const branch = [userEntry('e1', 'short')];

		expect(await recorder.recordIfLarge(stubManager('s1', branch))).toEqual([]);

		branch.push(userEntry('e2', 'x'.repeat(1000)));
		expect(
			await recorder.recordIfLarge(stubManager('s1', branch)),
		).toHaveLength(1);
	});
});

describe('takeUntil', () => {
	const entries = [userEntry('e1'), userEntry('e2'), userEntry('e3')];

	it('excludes the named entry and everything after it', () => {
		expect(takeUntil(entries, 'e2').map(({ id }) => id)).toEqual(['e1']);
	});

	it('keeps everything when the entry is absent', () => {
		expect(takeUntil(entries, 'missing')).toHaveLength(3);
	});
});
