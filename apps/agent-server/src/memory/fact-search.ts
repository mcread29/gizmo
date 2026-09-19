import { type JournalFact, factSearchText } from './journal-fact';

export interface FactHit {
	score: number;
	fact: JournalFact;
}

/**
 * The subject is the fact's own claim about what it is about, so a query that
 * matches it is asking about that thing; matching the statement is weaker
 * evidence, since a statement mentions its neighbours in passing.
 */
const weights = { subject: 4, statement: 3 } as const;

/**
 * Ranks the facts still standing.
 *
 * Only live facts should ever be passed here. Retired ones stay on disk for
 * provenance, but surfacing them is the exact failure the tier was built to
 * fix: a superseded fact is not a weaker answer to rank below the current
 * one, it is a wrong answer.
 */
export function searchFacts(
	facts: readonly JournalFact[],
	terms: readonly string[],
): FactHit[] {
	if (terms.length === 0) return [];
	const hits: FactHit[] = [];
	for (const fact of facts) {
		const score = scoreFact(fact, terms);
		if (score > 0) hits.push({ score, fact });
	}
	// Among equal scores the later segment wins: it is the more recent
	// statement of something neither fact claims to retire.
	hits.sort(
		(left, right) =>
			right.score - left.score ||
			right.fact.segment.localeCompare(left.fact.segment),
	);
	return hits;
}

function scoreFact(fact: JournalFact, terms: readonly string[]): number {
	const subject = fact.subject.toLowerCase();
	const statement = fact.statement.toLowerCase();
	let total = 0;
	let covered = 0;
	for (const term of terms) {
		let matched = false;
		if (subject.includes(term)) {
			total += weights.subject;
			matched = true;
		}
		if (statement.includes(term)) {
			total += weights.statement;
			matched = true;
		}
		if (matched) covered += 1;
	}
	return covered === 0 ? 0 : total * covered;
}

/**
 * One fact as the model reads it, with the segment it came from so the claim
 * can be traced back and checked rather than taken on faith.
 */
export function formatFactHit(hit: FactHit): string {
	return `- ${hit.fact.subject}: ${hit.fact.statement} [${hit.fact.segment}]`;
}

/** Used by callers that want the fact text without the ranking. */
export { factSearchText };
