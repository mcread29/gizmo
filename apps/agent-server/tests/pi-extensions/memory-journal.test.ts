import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import memoryJournal from '../../src/pi-extensions/memory-journal';
import { journalExtensionPath } from '../../src/sessions/pi-session-factory';
import { journalDir } from '../../src/memory/journal-store';

type Handler = (event: unknown, ctx: unknown) => Promise<void>;

function userEntry(id: string, text = 'hello'): SessionEntry {
	return {
		type: 'message',
		id,
		parentId: null,
		timestamp: new Date().toISOString(),
		message: { role: 'user', content: [{ type: 'text', text }] },
	} as SessionEntry;
}

function loadExtension() {
	const handlers = new Map<string, Handler>();
	const tools: string[] = [];
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		registerTool: (tool: { name: string }) => tools.push(tool.name),
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	memoryJournal(pi as any);
	return Object.assign(handlers, { tools });
}

function stubContext(cwd: string, branch: SessionEntry[]) {
	return {
		cwd,
		sessionManager: { getSessionId: () => 'sess1', getBranch: () => branch },
	};
}

describe('memory-journal extension', () => {
	let workspace: string;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), 'gizmo-journal-ext-'));
		delete process.env.GIZMO_MEMORY_JOURNAL;
	});

	afterEach(async () => {
		delete process.env.GIZMO_MEMORY_JOURNAL;
		await rm(workspace, { recursive: true, force: true });
	});

	it('subscribes to every boundary a span can leave context through', () => {
		expect([...loadExtension().keys()].sort()).toEqual([
			'before_agent_start',
			'session_before_tree',
			'session_compact',
			'session_shutdown',
			'turn_end',
		]);
	});

	it('journals a compacted span up to the entry context resumes from', async () => {
		const handlers = loadExtension();
		const branch = [userEntry('e1'), userEntry('e2'), userEntry('e3')];

		await handlers.get('session_compact')?.(
			{ compactionEntry: { firstKeptEntryId: 'e3' } },
			stubContext(workspace, branch),
		);

		const files = await readdir(journalDir(workspace));
		expect(files).toContain('0001-sess1.md');
		const index = files.filter((name) => name.endsWith('.md'));
		expect(index).toHaveLength(1);
	});

	it('journals the abandoned branch before tree navigation', async () => {
		const handlers = loadExtension();
		const branch = [userEntry('e1'), userEntry('e2')];

		await handlers.get('session_before_tree')?.(
			{},
			stubContext(workspace, branch),
		);

		expect(await readdir(journalDir(workspace))).toContain('0001-sess1.md');
	});

	it('records each span once across successive boundaries', async () => {
		const handlers = loadExtension();
		const branch = [userEntry('e1'), userEntry('e2')];
		const ctx = stubContext(workspace, branch);

		await handlers.get('session_compact')?.(
			{ compactionEntry: { firstKeptEntryId: 'e2' } },
			ctx,
		);
		await handlers.get('session_shutdown')?.({ reason: 'quit' }, ctx);

		const segments = (await readdir(journalDir(workspace))).filter((name) =>
			name.endsWith('.md'),
		);
		expect(segments).toEqual(['0001-sess1.md', '0002-sess1.md']);
	});

	it('stays silent when a handler throws', async () => {
		const handlers = loadExtension();
		const broken = {
			cwd: workspace,
			sessionManager: {
				getSessionId: () => 'sess1',
				getBranch: () => {
					throw new Error('branch unavailable');
				},
			},
		};

		await expect(
			handlers.get('session_shutdown')?.({ reason: 'quit' }, broken),
		).resolves.toBeUndefined();
	});

	it('registers the journal read path as tools', () => {
		expect(loadExtension().tools).toEqual(['journal_search', 'journal_read']);
	});

	/**
	 * A replaced system prompt carries no tool list, so the model would never
	 * learn the tools exist. The handler adds one line in that case and stays
	 * out of the way when Pi's own prompt already lists them.
	 */
	it('names the tools in a system prompt that does not mention them', async () => {
		const handlers = loadExtension();
		const handler = handlers.get('before_agent_start');

		const replaced = (await handler?.(
			{ systemPrompt: 'You are a custom assistant.' },
			{ cwd: workspace },
		)) as { systemPrompt?: string } | undefined;
		expect(replaced?.systemPrompt).toMatch(/^You are a custom assistant./);
		expect(replaced?.systemPrompt).toContain('journal_search');
		expect(replaced?.systemPrompt).toContain('journal_read');

		const listed = await handler?.(
			{ systemPrompt: 'Available tools:\n- journal_search: ...' },
			{ cwd: workspace },
		);
		expect(listed).toBeUndefined();
	});

	it('registers nothing when journaling is switched off', () => {
		process.env.GIZMO_MEMORY_JOURNAL = '0';
		const loaded = loadExtension();
		expect(loaded.size).toBe(0);
		expect(loaded.tools).toEqual([]);
	});

	// Pi loads extensions by path, so a wrong path fails silently at runtime.
	it('resolves to the file the session factory hands to pi', async () => {
		expect((await stat(journalExtensionPath())).isFile()).toBe(true);
	});
});
