import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backfillJournal } from '../../src/memory/backfill';
import { JournalStore } from '../../src/memory/journal-store';

const temporary: string[] = [];

async function scratch(prefix: string): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), prefix));
	temporary.push(path);
	return path;
}

function claudeTranscript(cwd: string, sessionId: string, text: string) {
	return [
		JSON.stringify({ type: 'mode', sessionId }),
		JSON.stringify({
			type: 'user',
			uuid: `${sessionId}-u1`,
			parentUuid: null,
			sessionId,
			cwd,
			timestamp: '2026-01-02T00:00:00.000Z',
			message: { role: 'user', content: text },
		}),
	].join('\n');
}

describe('backfillJournal', () => {
	let workspace: string;
	let claudeDir: string;

	beforeEach(async () => {
		workspace = await scratch('gizmo-backfill-ws-');
		claudeDir = await scratch('gizmo-backfill-claude-');
	});

	afterEach(async () => {
		await Promise.all(
			temporary
				.splice(0)
				.map((path) => rm(path, { recursive: true, force: true })),
		);
	});

	it('imports only transcripts whose cwd is the workspace', async () => {
		const project = join(claudeDir, 'C--some-project');
		await mkdir(project, { recursive: true });
		await writeFile(
			join(project, 'mine.jsonl'),
			claudeTranscript(workspace, 'mine', 'my project work'),
		);
		await writeFile(
			join(project, 'other.jsonl'),
			claudeTranscript(join(workspace, 'elsewhere'), 'other', 'different work'),
		);

		const result = await backfillJournal({
			workspacePath: workspace,
			piSessionDirs: [],
			claudeProjectsDir: claudeDir,
		});

		expect(result.scanned).toBe(1);
		expect(result.imported).toHaveLength(1);
		expect(result.imported[0]?.source).toBe('claude-code');
		const store = new JournalStore(workspace);
		expect(await store.read(result.imported[0]?.id ?? '')).toContain(
			'my project work',
		);
	});

	it('is safe to run twice', async () => {
		const project = join(claudeDir, 'C--some-project');
		await mkdir(project, { recursive: true });
		await writeFile(
			join(project, 'mine.jsonl'),
			claudeTranscript(workspace, 'mine', 'my project work'),
		);
		const options = {
			workspacePath: workspace,
			piSessionDirs: [],
			claudeProjectsDir: claudeDir,
		};

		const first = await backfillJournal(options);
		const second = await backfillJournal(options);

		expect(first.imported).toHaveLength(1);
		expect(second.imported).toHaveLength(0);
		expect(second.skipped).toBe(1);
		expect(await new JournalStore(workspace).list()).toHaveLength(1);
	});

	it('records provenance in the segment frontmatter', async () => {
		const project = join(claudeDir, 'C--some-project');
		await mkdir(project, { recursive: true });
		await writeFile(
			join(project, 'mine.jsonl'),
			claudeTranscript(workspace, 'mine', 'my project work'),
		);

		const result = await backfillJournal({
			workspacePath: workspace,
			piSessionDirs: [],
			claudeProjectsDir: claudeDir,
		});

		const body = await new JournalStore(workspace).read(
			result.imported[0]?.id ?? '',
		);
		expect(body).toContain('source: claude-code');
		expect(body).toContain('trigger: backfill');
	});

	it('reports nothing when no source directory exists', async () => {
		const result = await backfillJournal({
			workspacePath: workspace,
			piSessionDirs: [join(workspace, 'missing')],
			claudeProjectsDir: join(workspace, 'missing'),
		});

		expect(result).toEqual({ imported: [], skipped: 0, scanned: 0 });
	});
});
