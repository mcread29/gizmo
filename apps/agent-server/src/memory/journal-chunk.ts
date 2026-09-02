import type {
	SessionEntry,
	SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import { normalizeSegment, type NormalizeLimits } from './journal-normalize';

/**
 * Target size of one segment on disk. Facts extracted later cite segment ids
 * permanently, so a segment has to be small enough that a citation points at
 * evidence rather than at a whole afternoon of transcript.
 */
export const defaultChunkBytes = 40_000;

/**
 * Splits a span into segment-sized runs without breaking a tool call away
 * from its result. The preferred cut is a turn boundary (a user message);
 * only a turn that alone exceeds the budget is cut again, and then only in
 * front of an assistant message, whose tool results always follow it.
 */
export function chunkEntries(
	entries: readonly SessionEntry[],
	limits?: NormalizeLimits,
	maxBytes = defaultChunkBytes,
): SessionEntry[][] {
	const measure = (run: readonly SessionEntry[]): number =>
		Buffer.byteLength(normalizeSegment(run, limits).body, 'utf8');

	const chunks: SessionEntry[][] = [];
	for (const turn of pack(splitBefore(entries, 'user'), measure, maxBytes)) {
		if (measure(turn) <= maxBytes) {
			chunks.push(turn);
			continue;
		}
		chunks.push(...pack(splitBefore(turn, 'assistant'), measure, maxBytes));
	}
	return chunks;
}

/** Groups entries so that each group starts at a message with `role`. */
function splitBefore(
	entries: readonly SessionEntry[],
	role: 'user' | 'assistant',
): SessionEntry[][] {
	const groups: SessionEntry[][] = [];
	for (const entry of entries) {
		const last = groups[groups.length - 1];
		if (!last || roleOf(entry) === role) groups.push([entry]);
		else last.push(entry);
	}
	return groups;
}

/**
 * Greedy packing: a group joins the open chunk unless that would push it past
 * the budget. Sizes are measured per group, so the true chunk size can differ
 * from the sum by a few separator bytes — close enough for a soft limit.
 */
function pack(
	groups: readonly SessionEntry[][],
	measure: (run: readonly SessionEntry[]) => number,
	maxBytes: number,
): SessionEntry[][] {
	const chunks: SessionEntry[][] = [];
	let open: SessionEntry[] = [];
	let openBytes = 0;
	for (const group of groups) {
		const bytes = measure(group);
		if (open.length > 0 && openBytes + bytes > maxBytes) {
			chunks.push(open);
			open = [];
			openBytes = 0;
		}
		open.push(...group);
		openBytes += bytes;
	}
	if (open.length > 0) chunks.push(open);
	return chunks;
}

function roleOf(entry: SessionEntry): string | undefined {
	if (entry.type !== 'message') return;
	return (entry as SessionMessageEntry).message.role;
}
