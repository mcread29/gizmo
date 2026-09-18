import type { JournalDigest } from './journal-digest';
import {
	digestPrompt,
	digestSystemPrompt,
	parseDigest,
} from './journal-digest';

/** Which model writes digests. Stored as a setting, so it is plain data. */
export interface DigestModelRef {
	provider: string;
	id: string;
}

export function formatModelRef(model: DigestModelRef): string {
	return `${model.provider}/${model.id}`;
}

/**
 * The one call a digest needs. Declared structurally rather than taking a
 * ModelRegistry so the pipeline can be tested without a provider, a
 * credential, or a network — which is most of what there is to test here.
 */
export type CompleteText = (
	systemPrompt: string,
	prompt: string,
	signal?: AbortSignal,
) => Promise<string>;

/**
 * Turns one segment into a digest, or returns undefined.
 *
 * Undefined is an ordinary outcome, not an error path: the model may be
 * unavailable, rate-limited, or answer with something that is not a digest.
 * Because digests are derived, a missing one costs only a later retry, so
 * nothing here throws and no caller has to handle a failure specially.
 */
export async function generateDigest(
	segment: string,
	segmentText: string,
	model: DigestModelRef,
	complete: CompleteText,
	signal?: AbortSignal,
): Promise<JournalDigest | undefined> {
	let raw: string;
	try {
		raw = await complete(digestSystemPrompt, digestPrompt(segmentText), signal);
	} catch {
		return;
	}
	return parseDigest(raw, segment, formatModelRef(model));
}

export interface BackfillProgress {
	done: number;
	total: number;
	failed: number;
	segment: string;
}

export interface BackfillOptions {
	/** Segments already digested are skipped unless this is set. */
	regenerate?: boolean;
	onProgress?: (progress: BackfillProgress) => void;
	signal?: AbortSignal;
	/**
	 * Segments digested at once. Kept low: the gateways rate-limit, and a
	 * backfill is background work that must not starve the chat the user is
	 * actually waiting on.
	 */
	concurrency?: number;
}

const defaultConcurrency = 4;

export interface BackfillResult {
	digested: number;
	skipped: number;
	failed: number;
	aborted: boolean;
}

/** The minimum of each store the backfill touches, so both can be faked. */
export interface BackfillStores {
	listSegments(): Promise<string[]>;
	readSegment(id: string): Promise<string | undefined>;
	digestedSegments(): Promise<string[]>;
	writeDigest(digest: JournalDigest): Promise<void>;
}

/**
 * Digests every segment that does not have one yet.
 *
 * A few segments are in flight at once. One at a time is simpler, but a
 * measured segment takes seconds of mostly-waiting, and a whole-history
 * backfill is thousands of them — enough that serial execution turns a
 * twenty-minute job into an overnight one. Each digest is written as it is
 * produced rather than at the end, so an interrupted or aborted run keeps
 * everything it finished and the next run resumes at what is missing.
 */
export async function backfillDigests(
	stores: BackfillStores,
	model: DigestModelRef,
	complete: CompleteText,
	options: BackfillOptions = {},
): Promise<BackfillResult> {
	const segments = await stores.listSegments();
	const already = new Set(
		options.regenerate ? [] : await stores.digestedSegments(),
	);
	const pending = segments.filter((segment) => !already.has(segment));
	const skipped = segments.length - pending.length;

	let digested = 0;
	let failed = 0;
	let next = 0;
	let aborted = false;

	const worker = async (): Promise<void> => {
		for (;;) {
			if (options.signal?.aborted) {
				aborted = true;
				return;
			}
			const index = next;
			next += 1;
			const segment = pending[index];
			if (segment === undefined) return;

			const text = await stores.readSegment(segment);
			const digest = text
				? await generateDigest(segment, text, model, complete, options.signal)
				: undefined;
			if (digest) {
				await stores.writeDigest(digest);
				digested += 1;
			} else {
				failed += 1;
			}
			options.onProgress?.({
				done: digested + failed,
				total: pending.length,
				failed,
				segment,
			});
		}
	};

	const width = Math.max(1, options.concurrency ?? defaultConcurrency);
	await Promise.all(
		Array.from({ length: Math.min(width, pending.length) }, worker),
	);
	return { digested, skipped, failed, aborted };
}
