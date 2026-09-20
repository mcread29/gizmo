import type { CompleteText, DigestModelRef } from './digest-generator';
import { formatModelRef } from './digest-generator';
import { factPrompt, factSystemPrompt, relevantFacts } from './fact-prompt';
import type { JournalDigest } from './journal-digest';
import {
	type JournalFact,
	type SegmentFacts,
	currentFacts,
	parseFacts,
} from './journal-fact';

/**
 * Derives one segment's facts from its digest, or returns undefined.
 *
 * Undefined is an ordinary outcome for the same reason it is in
 * `generateDigest`: the tier is derived, so a missing entry costs a retry.
 * Note that this is distinct from an entry with no facts, which is the
 * common and correct answer — the difference is "the model could not be
 * asked" versus "the model was asked and nothing changed".
 */
export async function generateFacts(
	digest: JournalDigest,
	known: readonly JournalFact[],
	model: DigestModelRef,
	complete: CompleteText,
	signal?: AbortSignal,
	onFailure?: (reason: string) => void,
): Promise<SegmentFacts | undefined> {
	const shown = relevantFacts(digest, known);
	let raw: string;
	try {
		raw = await complete(factSystemPrompt, factPrompt(digest, shown), signal);
	} catch (error) {
		onFailure?.(error instanceof Error ? error.message : String(error));
		return;
	}
	// Only the ids actually shown are citable. A model asked to supersede will
	// sometimes cite a plausible id it never saw, and accepting those would
	// retire facts on the strength of a guess.
	const citable = new Set(shown.map((fact) => fact.id));
	const entry = parseFacts(raw, digest.segment, formatModelRef(model), citable);
	if (!entry)
		onFailure?.(`The model did not answer with facts: ${preview(raw)}`);
	return entry;
}

function preview(raw: string): string {
	const collapsed = raw.replace(/\s+/g, ' ').trim();
	if (collapsed.length === 0) return '(empty answer)';
	return collapsed.length > 160 ? `${collapsed.slice(0, 160)}…` : collapsed;
}

export interface FactBuildProgress {
	done: number;
	total: number;
	failed: number;
	segment: string;
	/** Facts standing after this segment, so the UI can show the tier growing. */
	facts: number;
	error?: string;
}

export interface FactBuildOptions {
	regenerate?: boolean;
	onProgress?: (progress: FactBuildProgress) => void;
	onFailure?: (segment: string, reason: string) => void;
	signal?: AbortSignal;
}

export interface FactBuildResult {
	processed: number;
	skipped: number;
	failed: number;
	/** How many facts stand at the end of the run. */
	facts: number;
	aborted: boolean;
	error?: string;
}

/** The minimum of each store the build touches, so both can be faked. */
export interface FactBuildStores {
	listDigests(): Promise<JournalDigest[]>;
	listFacts(): Promise<SegmentFacts[]>;
	writeFacts(entry: SegmentFacts): Promise<void>;
}

/**
 * Builds the fact tier from the digest tier, oldest segment first.
 *
 * Strictly sequential, which is the expensive property of this tier and not an
 * oversight. A segment's facts are derived against the facts already standing,
 * so the model must see the result of every earlier segment before it can
 * judge what this one retires. Running two segments at once would have both
 * deciding against the same stale record, and the later supersession would be
 * made on a view that never existed.
 *
 * Each entry is written as it is produced, and the run seeds itself from what
 * is already on disk, so an interrupted build resumes rather than restarts.
 */
export async function buildFacts(
	stores: FactBuildStores,
	model: DigestModelRef,
	complete: CompleteText,
	options: FactBuildOptions = {},
): Promise<FactBuildResult> {
	const digests = [...(await stores.listDigests())].sort((a, b) =>
		a.segment.localeCompare(b.segment),
	);
	const existing = options.regenerate ? [] : await stores.listFacts();
	const done = new Set(existing.map((entry) => entry.segment));
	const pending = digests.filter((digest) => !done.has(digest.segment));

	// The accumulating record. Held in memory and replayed rather than re-read
	// per segment: the fold is cheap and the disk read is not.
	const accumulated = [...existing];
	let standing = currentFacts(accumulated);

	let processed = 0;
	let failed = 0;
	let error: string | undefined;
	let aborted = false;

	for (const digest of pending) {
		if (options.signal?.aborted) {
			aborted = true;
			break;
		}
		const entry = await generateFacts(
			digest,
			standing,
			model,
			complete,
			options.signal,
			(reason) => {
				error = reason;
				options.onFailure?.(digest.segment, reason);
			},
		);
		if (entry) {
			await stores.writeFacts(entry);
			accumulated.push(entry);
			standing = currentFacts(accumulated);
			processed += 1;
		} else {
			failed += 1;
		}
		options.onProgress?.({
			done: processed + failed,
			total: pending.length,
			failed,
			segment: digest.segment,
			facts: standing.length,
			...(error ? { error } : {}),
		});
	}

	return {
		processed,
		skipped: digests.length - pending.length,
		failed,
		facts: standing.length,
		aborted,
		...(error ? { error } : {}),
	};
}
