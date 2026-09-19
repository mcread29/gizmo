import type { SearchHit } from './journal-search';

/**
 * Turning one segment's text into the excerpts a search reports.
 *
 * Split from the search itself because this is the only part that reads a
 * segment's bytes: the search decides which segments are worth opening, and
 * everything here decides what to show once one is open.
 */

/** Long lines are usually JSON tool arguments; keep the neighbourhood of the hit. */
const maxLineChars = 240;

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
export function excerpts(
	segment: string,
	text: string,
	terms: string[],
	settings: { context: number },
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
