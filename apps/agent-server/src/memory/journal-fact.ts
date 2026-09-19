/**
 * The journal's third tier: what is currently true, as opposed to what was
 * once decided.
 *
 * Digests are per-segment and immutable, which is correct for a record of work
 * but wrong for recall. "The digest model is minimax-m3" and "the digest model
 * is now glm-5.3" are both accurate digests of their own segments, and both
 * surface forever with equal standing. The longer the journal runs the more of
 * this it accumulates, and the failure is quiet: nothing is wrong, there is
 * just no way to tell which answer is current.
 *
 * A fact is one statement with a subject and a provenance, and it may retire
 * earlier facts by id. Supersession is recorded when the fact is derived, not
 * inferred when it is read, because "same subject, later segment" is not
 * evidence of replacement: most facts about a subject accumulate rather than
 * contradict. Retiring one has to be a judgment somebody made.
 *
 * Like digests, facts are derived and disposable: every one restates something
 * a segment already says, so the whole tier can be deleted and rebuilt.
 */

export interface JournalFact {
	/** `<segment>#<n>`. Stable across rebuilds only if the digest is stable. */
	id: string;
	/** The segment this was drawn from. */
	segment: string;
	/** When the fact was derived, not when the segment was recorded. */
	at: string;
	/**
	 * A short key naming what the fact is about, shared across segments so a
	 * later fact can be recognised as speaking to the same thing.
	 */
	subject: string;
	/** The claim, written to be understandable with no surrounding context. */
	statement: string;
	/** Ids of facts this replaces. Empty for a fact that adds rather than corrects. */
	supersedes: string[];
}

/** Facts asserted by one segment, stored as a unit. */
export interface SegmentFacts {
	segment: string;
	at: string;
	model: string;
	facts: JournalFact[];
}

/**
 * The facts still standing, oldest first.
 *
 * Replay rather than a stored "current" set: supersession is only ever
 * recorded forward, so the live view is a fold over the tier in segment
 * order. Nothing needs rewriting when a fact is retired, which is what keeps
 * per-segment files disjoint and mergeable between machines.
 */
export function currentFacts(segments: readonly SegmentFacts[]): JournalFact[] {
	const ordered = [...segments].sort((a, b) => a.segment.localeCompare(b.segment));
	const retired = new Set<string>();
	for (const entry of ordered)
		for (const fact of entry.facts)
			for (const id of fact.supersedes) retired.add(id);
	const live: JournalFact[] = [];
	for (const entry of ordered)
		for (const fact of entry.facts)
			if (!retired.has(fact.id)) live.push(fact);
	return live;
}

/**
 * Every fact ever asserted about a subject, newest first, including retired
 * ones. The history is why supersession is safe to apply: a fact that turns
 * out to have been retired wrongly is still on disk and still attributable.
 */
export function factHistory(
	segments: readonly SegmentFacts[],
	subject: string,
): JournalFact[] {
	const key = normalizeSubject(subject);
	return [...segments]
		.sort((a, b) => b.segment.localeCompare(a.segment))
		.flatMap((entry) => entry.facts)
		.filter((fact) => normalizeSubject(fact.subject) === key);
}

/**
 * Subjects are model-written, so they vary in case and spacing for what is
 * plainly the same thing. Compared loosely for that reason, and never used as
 * a filename.
 */
export function normalizeSubject(subject: string): string {
	return subject.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

/** The text a fact contributes to search. */
export function factSearchText(fact: JournalFact): string {
	return `${fact.subject}\n${fact.statement}`;
}

/** Facts are model output, so nothing about their shape is assumed. */
export function parseFacts(
	raw: string,
	segment: string,
	model: string,
	knownIds: ReadonlySet<string>,
): SegmentFacts | undefined {
	const json = extractJson(raw);
	if (!json) return;
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return;
	}
	const list = Array.isArray(parsed)
		? parsed
		: parsed && typeof parsed === 'object'
			? (parsed as Record<string, unknown>).facts
			: undefined;
	if (!Array.isArray(list)) return;

	const at = new Date().toISOString();
	const facts: JournalFact[] = [];
	for (const entry of list) {
		if (!entry || typeof entry !== 'object') continue;
		const record = entry as Record<string, unknown>;
		const subject =
			typeof record.subject === 'string' ? record.subject.trim() : '';
		const statement =
			typeof record.statement === 'string' ? record.statement.trim() : '';
		if (!subject || !statement) continue;
		facts.push({
			id: `${segment}#${facts.length + 1}`,
			segment,
			at,
			subject,
			statement,
			// A model will cheerfully cite ids that do not exist. An unknown id
			// would retire nothing, but it would also hide that the supersession
			// it was claiming never happened, so they are dropped here.
			supersedes: stringList(record.supersedes).filter((id) =>
				knownIds.has(id),
			),
		});
	}
	// A segment that asserts nothing is a real answer, not a failure: most
	// segments change no standing fact.
	return { segment, at, model, facts };
}

function stringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	for (const entry of value) {
		if (typeof entry !== 'string') continue;
		const trimmed = entry.trim();
		if (trimmed) out.push(trimmed);
	}
	return out;
}

/** Models wrap JSON in prose or fences more often than not. */
function extractJson(raw: string): string | undefined {
	const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
	const body = (fenced?.[1] ?? raw).trim();
	const objectStart = body.indexOf('{');
	const arrayStart = body.indexOf('[');
	const useArray =
		arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart);
	const start = useArray ? arrayStart : objectStart;
	const end = useArray ? body.lastIndexOf(']') : body.lastIndexOf('}');
	if (start < 0 || end <= start) return;
	return body.slice(start, end + 1);
}
