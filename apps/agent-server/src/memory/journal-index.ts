import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { defaultDataDir } from '../sessions/session-repository';
import type { JournalSegmentMeta, JournalStore } from './journal-store';

/**
 * A full-text index over segment bodies, used only to decide which segments
 * are worth reading.
 *
 * The journal is append-only markdown and search scanned all of it, which at
 * 500 segments is half a second per query and grows with the project. The
 * index turns that into a lookup plus a handful of file reads.
 *
 * It is strictly an optimization and never a source of truth. Ranking and
 * excerpting still happen on the real files, so the index can only change
 * which segments are *considered*, never what a considered segment scores.
 * Every failure path falls back to scanning everything, because a corrupt
 * cache must not be able to make search wrong -- only slow.
 *
 * It lives in the data directory rather than the repository. The file is
 * binary, cannot be merged, and is rebuildable from the segments in seconds,
 * so committing it would add conflicts to every sync and buy nothing.
 */
export class JournalIndex {
	readonly #file: string;
	#db: DatabaseSync | undefined;
	#broken = false;

	constructor(workspacePath: string) {
		const dir = join(defaultDataDir(), 'index');
		// The path is hashed rather than escaped: workspace paths contain
		// separators, drive letters and non-ASCII, and the index only ever needs
		// to find its own file again, never to be read back into a path.
		const key = createHash('sha256').update(workspacePath).digest('hex');
		this.#file = join(dir, `${key.slice(0, 32)}.sqlite`);
		try {
			mkdirSync(dir, { recursive: true });
		} catch {
			this.#broken = true;
		}
	}

	/**
	 * Brings the index level with the journal, then returns every segment whose
	 * body matches -- unranked and uncapped.
	 *
	 * Returning all of them rather than the best few is what makes the indexed
	 * and unindexed searches agree exactly. bm25 ranks by term density over the
	 * whole segment, which is a poor proxy for the line-level score search
	 * actually uses: a long segment holding one perfect line ranks low, so any
	 * cap silently drops hits the scan would have reported.
	 *
	 * `undefined` means the index is unusable and the caller should scan every
	 * segment instead -- deliberately distinct from an empty array, which means
	 * the index worked and nothing matched.
	 */
	async candidates(
		store: JournalStore,
		terms: readonly string[],
	): Promise<string[] | undefined> {
		if (terms.length === 0) return [];
		const db = await this.#sync(store);
		if (!db) return undefined;
		try {
			const rows = db
				.prepare(`SELECT segment FROM segments WHERE body MATCH ?`)
				.all(matchExpression(terms)) as { segment: string }[];
			return rows.map((row) => row.segment);
		} catch {
			// A malformed MATCH expression is the likely cause and is not worth
			// distinguishing: scanning still answers the query.
			return undefined;
		}
	}

	/** Drops the cache so the next search rebuilds it from the segments. */
	close(): void {
		this.#db?.close();
		this.#db = undefined;
	}

	async #sync(store: JournalStore): Promise<DatabaseSync | undefined> {
		if (this.#broken) return undefined;
		try {
			const db = this.#open();
			const indexed = new Map<string, number>();
			for (const row of db.prepare('SELECT segment, bytes FROM state').all() as {
				segment: string;
				bytes: number;
			}[]) {
				indexed.set(row.segment, row.bytes);
			}

			const segments = await store.list();
			const live = new Set(segments.map((meta) => meta.id));
			const stale = [...indexed.keys()].filter((id) => !live.has(id));
			const pending = segments.filter(
				(meta) => indexed.get(meta.id) !== meta.bytes,
			);
			if (stale.length === 0 && pending.length === 0) return db;

			for (const id of stale) remove(db, id);
			for (const meta of pending) {
				const text = await store.read(meta.id);
				if (text === undefined) continue;
				// A changed segment is deleted before insert rather than updated:
				// the FTS table and the state table must not disagree about how
				// many rows a segment has.
				remove(db, meta.id);
				insert(db, meta, text);
			}
			return db;
		} catch {
			// A cache that cannot be opened or written is not an error a search
			// should surface. Give up on it for the life of this object so one
			// bad file does not cost every later query a retry.
			this.#broken = true;
			this.#db = undefined;
			return undefined;
		}
	}

	#open(): DatabaseSync {
		if (this.#db) return this.#db;
		const db = new DatabaseSync(this.#file);
		// WAL so a search in one process is not blocked by an indexing write in
		// another; both happen whenever two Gizmo windows share a workspace.
		db.exec('PRAGMA journal_mode = WAL');
		db.exec(
			'CREATE VIRTUAL TABLE IF NOT EXISTS segments USING fts5(segment UNINDEXED, body)',
		);
		db.exec(
			`CREATE TABLE IF NOT EXISTS state (
				segment TEXT PRIMARY KEY,
				bytes INTEGER NOT NULL
			)`,
		);
		this.#db = db;
		return db;
	}
}

function remove(db: DatabaseSync, segment: string): void {
	db.prepare('DELETE FROM segments WHERE segment = ?').run(segment);
	db.prepare('DELETE FROM state WHERE segment = ?').run(segment);
}

function insert(
	db: DatabaseSync,
	meta: JournalSegmentMeta,
	text: string,
): void {
	db.prepare('INSERT INTO segments(segment, body) VALUES (?, ?)').run(
		meta.id,
		text,
	);
	db.prepare('INSERT INTO state(segment, bytes) VALUES (?, ?)').run(
		meta.id,
		meta.bytes,
	);
}

/**
 * Builds the FTS query as an OR of quoted prefix terms.
 *
 * OR rather than AND because the scan this replaces reports a segment that
 * matches any term, and narrowing here would drop results the unindexed
 * search returned. Quoting keeps terms holding punctuation -- filenames,
 * versions -- from being read as FTS operators.
 *
 * The trailing `*` recovers most of the difference between this and the scan:
 * the scan matches substrings, so "vite" finds "vitest", while FTS matches
 * whole tokens. Prefix search closes the common case and leaves one gap --
 * a term that appears only in the middle of a longer word, like "host" inside
 * "allowedHosts" -- which is why a caller that cannot tolerate a miss should
 * scan instead of index.
 */
function matchExpression(terms: readonly string[]): string {
	return terms
		.map((term) => `"${term.replace(/"/g, '""')}"*`)
		.join(' OR ');
}
