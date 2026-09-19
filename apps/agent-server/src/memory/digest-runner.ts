import { DigestStore } from './digest-store';
import { completeWithGizmoModel } from './digest-model';
import { DigestSettingsStore } from './digest-settings';
import { generateDigest } from './digest-generator';
import { generateFacts } from './fact-generator';
import { FactStore } from './fact-store';
import type { JournalSegmentMeta } from './journal-store';
import { JournalStore } from './journal-store';

/**
 * Digests segments as they are journaled.
 *
 * Every path here is best-effort and detached from the turn that triggered it.
 * Journaling must keep working when the digest model is unconfigured,
 * unauthenticated, rate-limited or simply wrong, so nothing in this file can
 * reject into a session: a failure leaves a segment without a digest, which a
 * later backfill fills in.
 *
 * Work is serialized per workspace. Segments arrive in bursts — one append can
 * write several — and letting a burst fan out would put the user's own chat
 * behind a queue of background requests on the same provider. The fact tier
 * needs that serialization for correctness rather than politeness: a segment's
 * facts are judged against the facts already standing, so two segments derived
 * at once would both decide against the same stale record.
 */
export class DigestRunner {
	readonly #settings: DigestSettingsStore;
	readonly #queues = new Map<string, Promise<void>>();

	constructor(settings = new DigestSettingsStore()) {
		this.#settings = settings;
	}

	/** Queues digests for freshly written segments. Never throws, never awaits. */
	schedule(
		workspacePath: string,
		segments: readonly JournalSegmentMeta[],
	): void {
		if (segments.length === 0) return;
		const ids = segments.map(({ id }) => id);
		const queued = (this.#queues.get(workspacePath) ?? Promise.resolve())
			.then(() => this.#run(workspacePath, ids))
			.catch((error: unknown) => {
				console.error('Memory digest failed:', error);
			});
		this.#queues.set(workspacePath, queued);
	}

	/** Resolves once queued work for a workspace has drained. For tests. */
	async idle(workspacePath: string): Promise<void> {
		await this.#queues.get(workspacePath);
	}

	async #run(workspacePath: string, ids: readonly string[]): Promise<void> {
		const settings = await this.#settings.read(workspacePath);
		// No model chosen is the normal state until the user picks one, so it is
		// silent rather than an error every segment would repeat.
		if (!settings.auto || !settings.model) return;

		const journal = new JournalStore(workspacePath);
		const digests = new DigestStore(workspacePath);
		const facts = new FactStore(workspacePath);
		const complete = await completeWithGizmoModel(settings.model);

		for (const id of ids) {
			const text = await journal.read(id);
			if (!text) continue;
			const digest = await generateDigest(
				id,
				text,
				settings.model,
				complete,
				undefined,
				(reason) => console.error(`Memory digest failed for ${id}:`, reason),
			);
			if (!digest) continue;
			await digests.write(digest);

			// Facts are derived from the digest just written, against whatever is
			// standing right now — which is why this reads the store each time
			// rather than hoisting it: an earlier segment in this same burst may
			// have just changed it.
			const entry = await generateFacts(
				digest,
				await facts.current(),
				settings.model,
				complete,
				undefined,
				(reason) => console.error(`Memory facts failed for ${id}:`, reason),
			);
			if (entry) await facts.write(entry);
		}
	}
}
