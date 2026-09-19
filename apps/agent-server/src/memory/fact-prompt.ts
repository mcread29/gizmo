import type { JournalDigest } from './journal-digest';
import { type JournalFact, normalizeSubject } from './journal-fact';

export const factSystemPrompt =
	'You maintain a small set of currently-true facts about a software project. You are shown one segment digest and the facts already on record, and you report only what changed. Reply with one JSON object and nothing else.';

/**
 * Which existing facts to show for a digest.
 *
 * The whole fact set is the correct context and the wrong amount of it: it
 * grows without bound while the model's budget does not. Facts are preselected
 * lexically, which is a weaker filter than the model would apply but errs the
 * safe way — a fact that is not shown is simply not superseded, leaving a
 * duplicate to resolve later rather than retiring something wrongly.
 */
export function relevantFacts(
	digest: JournalDigest,
	facts: readonly JournalFact[],
	limit = 40,
): JournalFact[] {
	const terms = new Set(
		termsOf(
			[digest.summary, ...digest.decisions, ...digest.files].join(' '),
		),
	);
	const scored = facts.map((fact) => {
		const subject = new Set(termsOf(fact.subject));
		const statement = new Set(termsOf(fact.statement));
		let score = 0;
		for (const term of subject) if (terms.has(term)) score += 3;
		for (const term of statement) if (terms.has(term)) score += 1;
		return { fact, score };
	});
	return scored
		.filter((entry) => entry.score > 0)
		.sort((a, b) =>
			b.score === a.score
				? b.fact.segment.localeCompare(a.fact.segment)
				: b.score - a.score,
		)
		.slice(0, limit)
		.map((entry) => entry.fact);
}

function termsOf(text: string): string[] {
	return normalizeSubject(text)
		.split(/[^a-z0-9.@/-]+/)
		.filter((term) => term.length > 2);
}

/**
 * The instruction leans hard on reporting nothing, because the default failure
 * here is inflation: a model asked what changed will find something in every
 * segment, and a fact tier that grows once per segment is just the digest tier
 * with extra steps. Most segments genuinely change no standing fact.
 */
export function factPrompt(
	digest: JournalDigest,
	known: readonly JournalFact[],
): string {
	const record =
		known.length > 0
			? known
					.map((fact) => `${fact.id} [${fact.subject}] ${fact.statement}`)
					.join('\n')
			: '(nothing on record yet)';

	return `Facts currently on record:

${record}

New segment digest:

Summary: ${digest.summary}
${digest.decisions.length > 0 ? `Decisions:\n${digest.decisions.map((d) => `- ${d}`).join('\n')}` : 'Decisions: none'}
${digest.files.length > 0 ? `Files: ${digest.files.join(', ')}` : ''}
Outcome: ${digest.outcome}

Report what this segment changes about the project's current state, as JSON:

{
  "facts": [
    {
      "subject": "A few words naming what the fact is about. Reuse the exact subject of an existing fact when speaking about the same thing.",
      "statement": "The claim, written to be understood on its own with no other context.",
      "supersedes": ["ids of facts above that this one makes untrue"]
    }
  ]
}

Rules:
- {"facts": []} is the normal answer. Most segments implement, debug, or explore without changing any standing fact. Report nothing rather than restating the summary.
- Report a fact only if it would still be worth knowing months later, and only if the digest states it. Never infer or invent.
- "supersedes" is for contradiction only: the earlier fact must now be wrong, not merely older or less detailed. Facts about one subject usually accumulate; leave "supersedes" empty unless something is genuinely retired.
- Do not restate a fact already on record. If it is unchanged, say nothing about it.
- Cite ids exactly as they appear above. Never invent an id.`;
}
