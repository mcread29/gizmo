import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import {
	appendFile,
	mkdir,
	readFile,
	rename,
	writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { AsyncMutex } from '../projects/async-mutex';
import { chunkEntries } from './journal-chunk';
import { normalizeSegment, type NormalizeLimits } from './journal-normalize';

/** Why a span left the live context and became a journal segment. */
export type JournalTrigger =
	'compaction' | 'threshold' | 'branch' | 'session-end' | 'backfill';

/**
 * Where a segment's messages came from. Absent means a live Gizmo session;
 * the imported values let the knowledge layer tell derived facts sourced from
 * historical transcripts apart from ones it watched happen.
 */
export type JournalSource = 'pi-archive' | 'claude-code';

export interface JournalSegmentMeta {
	id: string;
	session: string;
	firstEntryId: string;
	lastEntryId: string;
	at: string;
	messages: number;
	bytes: number;
	trigger: JournalTrigger;
	source?: JournalSource;
}

export interface AppendOptions {
	sessionId: string;
	trigger: JournalTrigger;
	source?: JournalSource;
	limits?: NormalizeLimits;
}

export function journalDir(workspacePath: string): string {
	return join(workspacePath, '.gizmo', 'memory', 'journal');
}

/**
 * The append-only half of memory. Segments are written once and never
 * rewritten, so the derived knowledge layer can always be thrown away and
 * rebuilt from here. Nothing in this class calls a model: journaling must
 * keep working when extraction is unavailable or failing.
 */
export class JournalStore {
	readonly #dir: string;
	readonly #indexFile: string;
	readonly #mutex = new AsyncMutex();

	constructor(workspacePath: string) {
		this.#dir = journalDir(workspacePath);
		this.#indexFile = join(this.#dir, 'index.jsonl');
	}

	/**
	 * Records a span as one or more segments, in order. Returns an empty list
	 * when the span holds no messages, so callers can fire on every boundary
	 * without guarding first. Each index line is written after its segment
	 * file, making a crash mid-append leave an unreferenced segment rather than
	 * a dangling index entry. Because every chunk lands in the index, the last
	 * chunk's `lastEntryId` is what `resumeAfter` finds later.
	 */
	async append(
		entries: readonly SessionEntry[],
		options: AppendOptions,
	): Promise<JournalSegmentMeta[]> {
		const messageEntries = entries.filter((entry) => entry.type === 'message');
		if (messageEntries.length === 0) return [];

		return this.#mutex.run(async () => {
			const written: JournalSegmentMeta[] = [];
			let count = (await this.#readIndex()).length;
			for (const chunk of chunkEntries(messageEntries, options.limits)) {
				const meta = await this.#write(chunk, options, count + 1);
				if (!meta) continue;
				written.push(meta);
				count += 1;
			}
			return written;
		});
	}

	async #write(
		chunk: readonly SessionEntry[],
		options: AppendOptions,
		number: number,
	): Promise<JournalSegmentMeta | undefined> {
		const first = chunk[0];
		const last = chunk[chunk.length - 1];
		if (!first || !last) return;
		const segment = normalizeSegment(chunk, options.limits);
		if (!segment.body.trim()) return;

		const meta: JournalSegmentMeta = {
			id: String(number).padStart(4, '0'),
			session: safeSessionId(options.sessionId),
			firstEntryId: first.id,
			lastEntryId: last.id,
			at: new Date().toISOString(),
			messages: segment.messages,
			bytes: Buffer.byteLength(segment.body, 'utf8'),
			trigger: options.trigger,
			...(options.source ? { source: options.source } : {}),
		};

		await mkdir(this.#dir, { recursive: true });
		const file = join(this.#dir, segmentFileName(meta));
		const temporary = `${file}.tmp`;
		await writeFile(temporary, renderSegment(meta, segment.body), 'utf8');
		await rename(temporary, file);
		await appendFile(this.#indexFile, `${JSON.stringify(meta)}\n`, 'utf8');
		return meta;
	}

	async list(): Promise<JournalSegmentMeta[]> {
		return this.#readIndex();
	}

	async read(id: string): Promise<string | undefined> {
		const meta = (await this.#readIndex()).find((entry) => entry.id === id);
		if (!meta) return;
		return readFile(join(this.#dir, segmentFileName(meta)), 'utf8');
	}

	/**
	 * The newest entry on this branch that a segment already ends at. Callers
	 * slice from just after it, which keeps repeated appends free of both gaps
	 * and overlap even when a boundary fires twice.
	 *
	 * Matching is by entry id across the whole project rather than by session
	 * id. Forking copies every entry into a new session file while preserving
	 * the original entry ids, so a session-keyed lookup would find nothing on a
	 * fork and re-journal the entire inherited history under the new id.
	 */
	async resumeAfter(
		entries: readonly SessionEntry[],
	): Promise<string | undefined> {
		const boundaries = new Set(
			(await this.#readIndex()).map((meta) => meta.lastEntryId),
		);
		for (let index = entries.length - 1; index >= 0; index -= 1) {
			const entry = entries[index];
			if (entry && boundaries.has(entry.id)) return entry.id;
		}
	}

	async #readIndex(): Promise<JournalSegmentMeta[]> {
		let raw: string;
		try {
			raw = await readFile(this.#indexFile, 'utf8');
		} catch (error) {
			if (isMissingFile(error)) return [];
			throw error;
		}
		const entries: JournalSegmentMeta[] = [];
		for (const line of raw.split('\n')) {
			if (!line.trim()) continue;
			try {
				entries.push(JSON.parse(line) as JournalSegmentMeta);
			} catch {
				// A torn final line loses one segment reference, not the journal.
			}
		}
		return entries;
	}
}

/**
 * Entries after the last journaled one. An unknown id means the session has
 * not been journaled yet — or its segment predates the current branch — so
 * everything is returned rather than nothing, keeping the journal complete.
 */
export function entriesSince(
	entries: readonly SessionEntry[],
	lastEntryId: string | undefined,
): SessionEntry[] {
	if (!lastEntryId) return [...entries];
	const index = entries.findIndex((entry) => entry.id === lastEntryId);
	if (index < 0) return [...entries];
	return entries.slice(index + 1);
}

function segmentFileName(meta: JournalSegmentMeta): string {
	return `${meta.id}-${meta.session}.md`;
}

/** Frontmatter duplicates the index so a segment stands alone when read. */
function renderSegment(meta: JournalSegmentMeta, body: string): string {
	const frontmatter = [
		'---',
		`id: "${meta.id}"`,
		`session: ${meta.session}`,
		`entries: [${meta.firstEntryId}, ${meta.lastEntryId}]`,
		`at: ${meta.at}`,
		`messages: ${meta.messages}`,
		`trigger: ${meta.trigger}`,
		...(meta.source ? [`source: ${meta.source}`] : []),
		'---',
	].join('\n');
	return `${frontmatter}\n\n${body}\n`;
}

/** Session ids reach the filesystem as names, so they are constrained here. */
function safeSessionId(sessionId: string): string {
	const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
	if (!safe) throw new Error(`Unusable session id: ${sessionId}`);
	return safe;
}

function isMissingFile(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === 'object' &&
		'code' in error &&
		error.code === 'ENOENT'
	);
}
