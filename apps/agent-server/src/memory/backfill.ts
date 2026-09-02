import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseClaudeTranscript } from './claude-session-adapter';
import {
	JournalStore,
	type JournalSource,
	type JournalSegmentMeta,
} from './journal-store';

export interface BackfillSource {
	source: JournalSource;
	sessionId: string;
	startedAt: number;
	entries: SessionEntry[];
}

export interface BackfillResult {
	imported: JournalSegmentMeta[];
	skipped: number;
	scanned: number;
}

export interface BackfillOptions {
	workspacePath: string;
	piSessionDirs?: string[];
	claudeProjectsDir?: string;
	store?: JournalStore;
}

export function defaultPiSessionDirs(): string[] {
	return [
		join(homedir(), '.pi', 'agent', 'sessions'),
		join(homedir(), '.gizmo', 'sessions'),
	];
}

export function defaultClaudeProjectsDir(): string {
	return join(homedir(), '.claude', 'projects');
}

/**
 * Imports historical transcripts for one workspace as journal segments.
 *
 * Re-running is safe: source entry ids are preserved, so `resumeAfter` sees a
 * session it has already imported and contributes nothing. Sessions are
 * imported oldest first so segment numbering follows the order the work
 * actually happened in.
 */
export async function backfillJournal(
	options: BackfillOptions,
): Promise<BackfillResult> {
	const workspace = resolve(options.workspacePath);
	const store = options.store ?? new JournalStore(workspace);
	const collected = [
		...(await collectPiSessions(
			options.piSessionDirs ?? defaultPiSessionDirs(),
			workspace,
		)),
		...(await collectClaudeSessions(
			options.claudeProjectsDir ?? defaultClaudeProjectsDir(),
			workspace,
		)),
	];
	collected.sort((left, right) => left.startedAt - right.startedAt);

	const imported: JournalSegmentMeta[] = [];
	let skipped = 0;
	for (const candidate of collected) {
		const resume = await store.resumeAfter(candidate.entries);
		const pending = resume
			? candidate.entries.slice(
					candidate.entries.findIndex((entry) => entry.id === resume) + 1,
				)
			: candidate.entries;
		if (pending.length === 0) {
			skipped += 1;
			continue;
		}
		const written = await store.append(pending, {
			sessionId: candidate.sessionId,
			trigger: 'backfill',
			source: candidate.source,
		});
		if (written.length > 0) imported.push(...written);
		else skipped += 1;
	}
	return { imported, skipped, scanned: collected.length };
}

/**
 * Pi transcripts need no translation — they are the same format the live
 * journal reads — but they are opened through SessionManager so older files
 * are migrated to the current session version first.
 */
async function collectPiSessions(
	dirs: string[],
	workspace: string,
): Promise<BackfillSource[]> {
	const { SessionManager } = await import('@earendil-works/pi-coding-agent');
	const found: BackfillSource[] = [];
	for (const dir of dirs) {
		for (const file of await jsonlFiles(dir)) {
			try {
				const manager = SessionManager.open(file, dir);
				if (resolve(manager.getCwd() || '') !== workspace) continue;
				// getBranch(), not getEntries(): the tree also holds retried and
				// abandoned siblings, which import as duplicated prose.
				const entries = manager
					.getBranch()
					.filter((entry) => entry.type === 'message');
				if (entries.length === 0) continue;
				found.push({
					source: 'pi-archive',
					sessionId: manager.getSessionId(),
					startedAt: startedAt(entries),
					entries,
				});
			} catch {
				// An unreadable or foreign-format file is skipped, not fatal.
			}
		}
	}
	return found;
}

async function collectClaudeSessions(
	projectsDir: string,
	workspace: string,
): Promise<BackfillSource[]> {
	const found: BackfillSource[] = [];
	let projects: string[];
	try {
		projects = (await readdir(projectsDir, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory())
			.map((entry) => join(projectsDir, entry.name));
	} catch {
		return found;
	}
	for (const project of projects) {
		for (const file of await jsonlFiles(project)) {
			try {
				const transcript = parseClaudeTranscript(
					await readFile(file, 'utf8'),
					basename(file, '.jsonl'),
				);
				// The directory name is a mangled path; cwd on the records is exact.
				if (!transcript || resolve(transcript.cwd || '') !== workspace)
					continue;
				found.push({
					source: 'claude-code',
					sessionId: transcript.sessionId,
					startedAt: transcript.startedAt || startedAt(transcript.entries),
					entries: transcript.entries,
				});
			} catch {
				// Same policy as Pi: one bad file must not stop the import.
			}
		}
	}
	return found;
}

/**
 * Transcripts nest: Pi groups sessions into a directory per project, and
 * Claude Code does the same, so a flat scan of the root finds nothing.
 */
async function jsonlFiles(dir: string, depth = 2): Promise<string[]> {
	let entries: Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const files: string[] = [];
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path);
		else if (entry.isDirectory() && depth > 0) {
			files.push(...(await jsonlFiles(path, depth - 1)));
		}
	}
	return files;
}

function startedAt(entries: readonly SessionEntry[]): number {
	const first = entries[0];
	return first ? Date.parse(first.timestamp) || 0 : 0;
}
