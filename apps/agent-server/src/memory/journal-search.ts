import type { JournalStore } from './journal-store';

export interface SearchOptions {
	/** Lines of context kept on each side of a matching line. */
	context?: number;
	/** Most excerpts taken from a single segment, so one busy file cannot crowd out the rest. */
	perSegment?: number;
	maxHits?: number;
	/** Budget for all excerpt text together; the tool result goes into the model's context. */
	maxBytes?: number;
}

export interface SearchHit {
	segment: string;
	/** 1-based line in the segment file where the excerpt starts. */
	line: number;
	score: number;
	excerpt: string;
}

export interface SearchResult {
	terms: string[];
	hits: SearchHit[];
	/** True when caps dropped hits that matched. */
	truncated: boolean;
	segmentsSearched: number;
}

const defaults: Required<SearchOptions> = {
	context: 3,
	perSegment: 3,
	maxHits: 12,
	maxBytes: 12_000,
};

/** Long lines are usually JSON tool arguments; keep the neighbourhood of the hit. */
const maxLineChars = 240;

/**
 * Lexical search over every segment body. There is no index: the whole
 * journal is a few megabytes of markdown and a linear scan finishes in
 * milliseconds, which keeps the store append-only and free of derived state
 * that could drift from it.
 */
export async function searchJournal(
	store: JournalStore,
	query: string,
	options: SearchOptions = {},
): Promise<SearchResult> {
	const settings = { ...defaults, ...options };
	const terms = tokenize(query);
	const segments = await store.list();
	if (terms.length === 0) {
		return { terms, hits: [], truncated: false, segmentsSearched: 0 };
	}

	const candidates: SearchHit[] = [];
	for (const meta of segments) {
		const text = await store.read(meta.id);
		if (!text) continue;
		candidates.push(...excerpts(meta.id, text, terms, settings));
	}
	// Strongest match first; among equals, newer history is more likely to
	// still be true, so higher segment ids win.
	candidates.sort(
		(left, right) =>
			right.score - left.score ||
			right.segment.localeCompare(left.segment) ||
			left.line - right.line,
	);

	const hits: SearchHit[] = [];
	const taken = new Map<string, number>();
	let bytes = 0;
	let truncated = false;
	for (const hit of candidates) {
		const count = taken.get(hit.segment) ?? 0;
		const size = Buffer.byteLength(hit.excerpt, 'utf8');
		if (
			count >= settings.perSegment ||
			hits.length >= settings.maxHits ||
			bytes + size > settings.maxBytes
		) {
			truncated = true;
			continue;
		}
		taken.set(hit.segment, count + 1);
		bytes += size;
		hits.push(hit);
	}
	return { terms, hits, truncated, segmentsSearched: segments.length };
}

export function formatSearchResult(result: SearchResult): string {
	if (result.terms.length === 0) return 'No search terms given.';
	if (result.hits.length === 0) {
		return `No matches for ${result.terms.join(' ')} across ${result.segmentsSearched} journal segments.`;
	}
	const blocks = result.hits.map(
		(hit) => `[segment ${hit.segment} line ${hit.line}]\n${hit.excerpt}`,
	);
	const footer = result.truncated
		? '\n\n(More matches were omitted. Narrow the query, or use journal_read on a segment id above.)'
		: '';
	return `${blocks.join('\n\n')}${footer}`;
}

/** Splits the query into lowercase words; short words match nothing useful. */
export function tokenize(query: string): string[] {
	const seen = new Set<string>();
	for (const word of query.toLowerCase().split(/[^\p{L}\p{N}_.-]+/u)) {
		if (word.length >= 2) seen.add(word);
	}
	return [...seen];
}

interface Window {
	start: number;
	end: number;
	score: number;
}

/**
 * Scores each line by how many distinct terms it contains — a line holding
 * every term outranks any number of single-term lines — then widens each
 * matching line into a window and merges the windows that overlap.
 */
function excerpts(
	segment: string,
	text: string,
	terms: string[],
	settings: Required<SearchOptions>,
): SearchHit[] {
	const lines = text.split('\n');
	const firstBodyLine = bodyStart(lines);
	const windows: Window[] = [];
	for (let index = firstBodyLine; index < lines.length; index += 1) {
		const score = scoreLine(lines[index] ?? '', terms);
		if (score === 0) continue;
		const start = Math.max(firstBodyLine, index - settings.context);
		const end = Math.min(lines.length - 1, index + settings.context);
		const last = windows[windows.length - 1];
		if (last && start <= last.end + 1) {
			last.end = end;
			last.score = Math.max(last.score, score) + 1;
		} else {
			windows.push({ start, end, score });
		}
	}
	return windows.map((window) => ({
		segment,
		line: window.start + 1,
		score: window.score,
		excerpt: lines
			.slice(window.start, window.end + 1)
			.map((line) => clip(line, terms))
			.join('\n'),
	}));
}

function scoreLine(line: string, terms: string[]): number {
	const lower = line.toLowerCase();
	let distinct = 0;
	let occurrences = 0;
	for (const term of terms) {
		let at = lower.indexOf(term);
		if (at < 0) continue;
		distinct += 1;
		while (at >= 0) {
			occurrences += 1;
			at = lower.indexOf(term, at + term.length);
		}
	}
	return distinct === 0 ? 0 : distinct * 100 + Math.min(occurrences, 20);
}

function clip(line: string, terms: string[]): string {
	if (line.length <= maxLineChars) return line;
	const lower = line.toLowerCase();
	const hit = Math.min(
		...terms.map((term) => lower.indexOf(term)).filter((at) => at >= 0),
	);
	const start = Number.isFinite(hit)
		? Math.max(0, Math.min(hit - 40, line.length - maxLineChars))
		: 0;
	const slice = line.slice(start, start + maxLineChars);
	return `${start > 0 ? '…' : ''}${slice}…`;
}

/** Frontmatter repeats the index; matching on it would only surface ids. */
function bodyStart(lines: string[]): number {
	if (lines[0] !== '---') return 0;
	const close = lines.indexOf('---', 1);
	return close < 0 ? 0 : close + 1;
}
