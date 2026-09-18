import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JournalDigest } from './journal-digest';
import { journalDir } from './journal-store';

export function digestDir(workspacePath: string): string {
	return join(journalDir(workspacePath), 'digests');
}

/**
 * The journal's derived half: one digest file per segment.
 *
 * Deliberately not part of JournalStore. The journal is append-only and
 * authoritative; digests are rewritable, disposable, and produced by a model
 * that may be unavailable or wrong. Keeping them in a separate class keeps
 * that boundary visible — nothing here can corrupt a segment, and `clear()`
 * is a supported operation rather than a violation.
 *
 * One file per segment rather than a single index, because a segment is
 * digested on the machine that recorded it: parallel machines write disjoint
 * files and a sync merges them without conflict. A combined index would need
 * a merge driver, as the journal's own index does.
 */
export class DigestStore {
	readonly #dir: string;

	constructor(workspacePath: string) {
		this.#dir = digestDir(workspacePath);
	}

	/**
	 * Writes one digest, replacing any earlier one for that segment. Replacing
	 * is normal: re-running on a better model is the intended way to improve
	 * the layer.
	 */
	async write(digest: JournalDigest): Promise<void> {
		await mkdir(this.#dir, { recursive: true });
		const file = join(this.#dir, fileName(digest.segment));
		const temporary = `${file}.tmp`;
		await writeFile(temporary, `${JSON.stringify(digest, null, '\t')}\n`, 'utf8');
		// Rename so a reader never observes a half-written digest, and a crash
		// mid-write leaves the previous digest rather than a corrupt one.
		await rename(temporary, file);
	}

	async read(segment: string): Promise<JournalDigest | undefined> {
		let raw: string;
		try {
			raw = await readFile(join(this.#dir, fileName(segment)), 'utf8');
		} catch (error) {
			if (isMissingFile(error)) return;
			throw error;
		}
		return parse(raw, segment);
	}

	/** Every digest on disk, oldest segment first. */
	async list(): Promise<JournalDigest[]> {
		const digests: JournalDigest[] = [];
		for (const segment of await this.segments()) {
			const digest = await this.read(segment);
			if (digest) digests.push(digest);
		}
		return digests;
	}

	/** Which segments already have a digest, so a backfill can skip them. */
	async segments(): Promise<string[]> {
		let names: string[];
		try {
			names = await readdir(this.#dir);
		} catch (error) {
			if (isMissingFile(error)) return [];
			throw error;
		}
		return names
			.filter((name) => name.endsWith('.json'))
			.map((name) => decodeURIComponent(name.slice(0, -'.json'.length)))
			.sort();
	}

	/** Discards the whole derived layer. Segments are untouched. */
	async clear(): Promise<void> {
		await rm(this.#dir, { recursive: true, force: true });
	}
}

/**
 * Segment ids are filename-safe today, but they are model-facing strings that
 * have already changed shape once, so they are encoded rather than trusted.
 */
function fileName(segment: string): string {
	return `${encodeURIComponent(segment)}.json`;
}

/** A digest that no longer parses is treated as absent, so it regenerates. */
function parse(raw: string, segment: string): JournalDigest | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return;
	}
	if (!parsed || typeof parsed !== 'object') return;
	const record = parsed as Partial<JournalDigest>;
	if (typeof record.summary !== 'string' || !record.summary) return;
	return {
		segment: record.segment ?? segment,
		at: record.at ?? '',
		model: record.model ?? '',
		summary: record.summary,
		decisions: Array.isArray(record.decisions) ? record.decisions : [],
		files: Array.isArray(record.files) ? record.files : [],
		errors: Array.isArray(record.errors) ? record.errors : [],
		outcome: record.outcome ?? 'explored',
	};
}

function isMissingFile(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === 'object' &&
		'code' in error &&
		error.code === 'ENOENT'
	);
}
