import {
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import {
	type JournalFact,
	type SegmentFacts,
	currentFacts,
} from './journal-fact';
import { journalDir } from './journal-store';

export function factDir(workspacePath: string): string {
	return join(journalDir(workspacePath), 'facts');
}

/**
 * The fact tier on disk: one file per segment, holding what that segment
 * asserted and what it retired.
 *
 * Stored per segment for the same reason digests are — a segment is processed
 * on the machine that recorded it, so parallel machines write disjoint files
 * and a sync merges them without a driver. A single "current facts" file would
 * be rewritten on every derivation and would conflict on every sync, which is
 * precisely what the append-only shape exists to avoid.
 */
export class FactStore {
	readonly #dir: string;

	constructor(workspacePath: string) {
		this.#dir = factDir(workspacePath);
	}

	async write(entry: SegmentFacts): Promise<void> {
		await mkdir(this.#dir, { recursive: true });
		const file = join(this.#dir, fileName(entry.segment));
		const temporary = `${file}.tmp`;
		await writeFile(temporary, `${JSON.stringify(entry, null, '\t')}\n`, 'utf8');
		await rename(temporary, file);
	}

	async read(segment: string): Promise<SegmentFacts | undefined> {
		let raw: string;
		try {
			raw = await readFile(join(this.#dir, fileName(segment)), 'utf8');
		} catch (error) {
			if (isMissingFile(error)) return;
			throw error;
		}
		return parse(raw, segment);
	}

	/** Every segment's facts, oldest segment first. */
	async list(): Promise<SegmentFacts[]> {
		const entries: SegmentFacts[] = [];
		for (const segment of await this.segments()) {
			const entry = await this.read(segment);
			if (entry) entries.push(entry);
		}
		return entries;
	}

	/** The facts still standing. */
	async current(): Promise<JournalFact[]> {
		return currentFacts(await this.list());
	}

	/** Which segments have already been processed, so a rebuild can skip them. */
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

	/** Discards the tier. Segments and digests are untouched. */
	async clear(): Promise<void> {
		await rm(this.#dir, { recursive: true, force: true });
	}
}

function fileName(segment: string): string {
	return `${encodeURIComponent(segment)}.json`;
}

/** An entry that no longer parses is treated as absent, so it regenerates. */
function parse(raw: string, segment: string): SegmentFacts | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return;
	}
	if (!parsed || typeof parsed !== 'object') return;
	const record = parsed as Record<string, unknown>;
	if (!Array.isArray(record.facts)) return;
	const facts: JournalFact[] = [];
	for (const entry of record.facts) {
		if (!entry || typeof entry !== 'object') continue;
		const fact = entry as Partial<JournalFact>;
		if (typeof fact.subject !== 'string' || !fact.subject) continue;
		if (typeof fact.statement !== 'string' || !fact.statement) continue;
		facts.push({
			id: fact.id ?? `${segment}#${facts.length + 1}`,
			segment: fact.segment ?? segment,
			at: fact.at ?? '',
			subject: fact.subject,
			statement: fact.statement,
			supersedes: Array.isArray(fact.supersedes) ? fact.supersedes : [],
		});
	}
	return {
		segment: typeof record.segment === 'string' ? record.segment : segment,
		at: typeof record.at === 'string' ? record.at : '',
		model: typeof record.model === 'string' ? record.model : '',
		facts,
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
