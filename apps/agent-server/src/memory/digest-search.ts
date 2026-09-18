import type { JournalDigest } from './journal-digest';

export interface DigestHit {
	segment: string;
	score: number;
	digest: JournalDigest;
}

/**
 * How much each field is worth when a term matches in it.
 *
 * A summary is the digest's claim about what happened, and a decision is the
 * part most likely to still bind today, so both outrank the incidental
 * mention of a filename. Outcome is scored at all only so that "abandoned" or
 * "blocked" can be searched for directly.
 */
const weights = {
	summary: 4,
	decisions: 4,
	errors: 3,
	files: 2,
	outcome: 1,
} as const;

/**
 * Ranks digests against the same terms the segment scan uses.
 *
 * Digests are searched separately from segment bodies rather than being
 * folded into one scan, because they answer a different question. A segment
 * excerpt shows what was said at one moment, which may be a wrong guess made
 * early in a session; a digest states what was still true when the work
 * finished. Ranking them together would let a stray transcript line outrank
 * the conclusion drawn from it.
 */
export function searchDigests(
	digests: readonly JournalDigest[],
	terms: readonly string[],
): DigestHit[] {
	if (terms.length === 0) return [];
	const hits: DigestHit[] = [];
	for (const digest of digests) {
		const score = scoreDigest(digest, terms);
		if (score > 0) hits.push({ segment: digest.segment, score, digest });
	}
	// Among equal scores the later segment wins: newer conclusions supersede
	// older ones, and nothing here tracks supersession explicitly yet.
	hits.sort(
		(left, right) =>
			right.score - left.score || right.segment.localeCompare(left.segment),
	);
	return hits;
}

/**
 * Sums the weight of every field a term appears in, then multiplies by how
 * many distinct terms the digest covers. Covering two terms across two fields
 * beats covering one term four times over, which is what a reader wants: the
 * digest that is about the whole query, not the one that repeats a word.
 */
function scoreDigest(digest: JournalDigest, terms: readonly string[]): number {
	const fields: [number, string][] = [
		[weights.summary, digest.summary],
		[weights.decisions, digest.decisions.join('\n')],
		[weights.errors, digest.errors.join('\n')],
		[weights.files, digest.files.join('\n')],
		[weights.outcome, digest.outcome],
	];
	const lowered = fields.map(
		([weight, text]) => [weight, text.toLowerCase()] as const,
	);
	let total = 0;
	let covered = 0;
	for (const term of terms) {
		let matched = false;
		for (const [weight, text] of lowered) {
			if (!text.includes(term)) continue;
			total += weight;
			matched = true;
		}
		if (matched) covered += 1;
	}
	return covered === 0 ? 0 : total * covered;
}

/**
 * One digest as the model reads it. Empty sections are dropped rather than
 * printed empty: a digest with no recorded errors should not spend context
 * saying so.
 */
export function formatDigestHit(hit: DigestHit): string {
	const parts = [`[segment ${hit.segment} · ${hit.digest.outcome}]`];
	parts.push(hit.digest.summary);
	if (hit.digest.decisions.length > 0) {
		parts.push(hit.digest.decisions.map((line) => `- ${line}`).join('\n'));
	}
	if (hit.digest.errors.length > 0) {
		parts.push(
			`Errors:\n${hit.digest.errors.map((line) => `- ${line}`).join('\n')}`,
		);
	}
	if (hit.digest.files.length > 0) {
		parts.push(`Files: ${hit.digest.files.join(', ')}`);
	}
	return parts.join('\n');
}
