/**
 * The journal's derived layer: one small, structured summary per segment.
 *
 * Segments are whole transcripts — tens of kilobytes of prose, tool calls and
 * results — which makes searching them a search over noise. A digest is the
 * same span reduced to what stays true afterwards: what happened, what was
 * decided, what broke. Searching digests first and reading a segment only on a
 * hit turns a lexical scan over megabytes into one over a few hundred
 * kilobytes of prose about decisions.
 *
 * Digests are derived and disposable by contract. Nothing here is ever the
 * only copy of anything: every field restates something the segment already
 * says, so the whole digest set can be deleted and regenerated — on a better
 * model, or with a better prompt — without touching the append-only journal.
 */

/** What became of the work in a segment. */
export type DigestOutcome =
	| 'shipped'
	| 'abandoned'
	| 'blocked'
	| 'explored';

export const digestOutcomes: readonly DigestOutcome[] = [
	'shipped',
	'abandoned',
	'blocked',
	'explored',
];

export interface JournalDigest {
	/** The segment this describes. */
	segment: string;
	/** When the digest was written, not when the segment was recorded. */
	at: string;
	/** Which model wrote it, so a mixed-quality set can be re-run selectively. */
	model: string;
	/** One to three sentences: what this span of work actually did. */
	summary: string;
	/** Choices that outlive the segment, each stated so it reads alone. */
	decisions: string[];
	/** Repository-relative paths the work touched. */
	files: string[];
	/** Failures worth not repeating, each with what it turned out to be. */
	errors: string[];
	outcome: DigestOutcome;
}

/**
 * The text a digest contributes to search. Only the prose fields: paths and
 * the outcome tag would match too eagerly and crowd out real hits.
 */
export function digestSearchText(digest: JournalDigest): string {
	return [digest.summary, ...digest.decisions, ...digest.errors].join('\n');
}

/** Digests are model output, so nothing about their shape is assumed. */
export function parseDigest(
	raw: string,
	segment: string,
	model: string,
): JournalDigest | undefined {
	const json = extractJson(raw);
	if (!json) return;
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return;
	}
	if (!parsed || typeof parsed !== 'object') return;
	const record = parsed as Record<string, unknown>;

	const summary = typeof record.summary === 'string' ? record.summary.trim() : '';
	// A digest with no summary describes nothing; storing it would only put a
	// hole in the layer that later looks like a generated digest.
	if (!summary) return;

	const outcome = digestOutcomes.find((value) => value === record.outcome);

	return {
		segment,
		at: new Date().toISOString(),
		model,
		summary,
		decisions: stringList(record.decisions),
		files: stringList(record.files),
		errors: stringList(record.errors),
		outcome: outcome ?? 'explored',
	};
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

/**
 * Models wrap JSON in prose or fences more often than not, so the object is
 * located rather than required to stand alone.
 */
function extractJson(raw: string): string | undefined {
	const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
	const body = (fenced?.[1] ?? raw).trim();
	const start = body.indexOf('{');
	const end = body.lastIndexOf('}');
	if (start < 0 || end <= start) return;
	return body.slice(start, end + 1);
}

/**
 * Head and tail of a segment. A segment can exceed a small model's context,
 * and its two ends carry the most: the request that opened the span and the
 * outcome that closed it. The middle is mostly tool traffic.
 */
export function digestInput(segmentText: string, maxChars = 24_000): string {
	const body = segmentText.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
	if (body.length <= maxChars) return body;
	const half = Math.floor((maxChars - 40) / 2);
	return `${body.slice(0, half)}\n\n…[middle elided]…\n\n${body.slice(-half)}`;
}

export const digestSystemPrompt =
	'You summarize one segment of a software project\'s conversation transcript into a compact record of what stays true afterwards. Reply with one JSON object and nothing else.';

/**
 * The instruction is explicit that absent fields are normal. A model asked for
 * decisions and errors will otherwise manufacture them from ordinary work, and
 * invented decisions are worse than none: they are indistinguishable from real
 * ones at search time.
 */
export function digestPrompt(segmentText: string): string {
	return `Summarize this transcript segment as JSON with exactly these keys:

{
  "summary": "1-3 sentences: what this span of work actually did.",
  "decisions": ["Choices that still matter later. State each so it is understandable on its own, including the reason if the transcript gives one."],
  "files": ["Repository-relative paths that were created, edited, or deleted."],
  "errors": ["Failures hit, each with what it turned out to be, if the transcript says."],
  "outcome": "shipped | abandoned | blocked | explored"
}

Rules:
- Use only what the transcript states. Never infer or invent.
- Empty arrays are expected and correct. Most segments contain no durable decision and no error; say so with [] rather than promoting routine work.
- "files" means files actually changed, not files merely read or searched.
- outcome: "shipped" if the work landed and was verified, "abandoned" if it was dropped or reverted, "blocked" if it stopped on something unresolved, "explored" for reading, searching, or discussion that changed nothing.

Transcript segment:

${digestInput(segmentText)}`;
}
