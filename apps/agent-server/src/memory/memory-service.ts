import type {
	DigestOverride,
	DigestSettings,
	JournalFact,
	MemoryStatus,
} from '@gizmo/protocol';
import { backfillDigests, type BackfillProgress } from './digest-generator';
import { completeWithGizmoModel } from './digest-model';
import { DigestSettingsStore } from './digest-settings';
import { DigestStore } from './digest-store';
import { buildFacts } from './fact-generator';
import { FactStore } from './fact-store';
import { digestSearchText, type JournalDigest } from './journal-digest';
import { JournalStore } from './journal-store';

interface RunningBackfill {
	controller: AbortController;
	progress: BackfillProgress;
	phase: 'digests' | 'facts';
}

/**
 * Everything the UI does with the memory layer.
 *
 * Backfills are tracked per workspace rather than globally: a run is scoped to
 * one project's journal, and two projects have no reason to queue behind each
 * other. Starting one twice is a no-op rather than an error, because the
 * button that starts it can be clicked twice.
 */
export class MemoryService {
	readonly #settings = new DigestSettingsStore();
	readonly #running = new Map<string, RunningBackfill>();

	async status(workspacePath: string): Promise<MemoryStatus> {
		const factStore = new FactStore(workspacePath);
		const [
			segments,
			digested,
			facts,
			factSegments,
			settings,
			defaults,
			overridden,
		] = await Promise.all([
			new JournalStore(workspacePath).list(),
			new DigestStore(workspacePath).segments(),
			factStore.current(),
			factStore.segments(),
			this.#settings.read(workspacePath),
			this.#settings.readDefault(),
			this.#settings.isOverridden(workspacePath),
		]);
		const active = this.#running.get(workspacePath);
		return {
			segments: segments.length,
			digested: digested.length,
			facts: facts.length,
			factSegments: factSegments.length,
			settings,
			defaults,
			overridden,
			...(active
				? {
						running: {
							done: active.progress.done,
							total: active.progress.total,
							failed: active.progress.failed,
							phase: active.phase,
							...(active.progress.error
								? { error: active.progress.error }
								: {}),
						},
					}
				: {}),
		};
	}

	/**
	 * Saved memories, newest first. Ordering is by segment id, which sorts by
	 * the ordinal prefix, so the most recent work is what a reader sees.
	 */
	async digests(
		workspacePath: string,
		query?: string,
		limit = 100,
	): Promise<JournalDigest[]> {
		const all = await new DigestStore(workspacePath).list();
		all.sort((left, right) => right.segment.localeCompare(left.segment));
		const terms = (query ?? '')
			.toLowerCase()
			.split(/\s+/)
			.filter((term) => term.length > 1);
		if (terms.length === 0) return all.slice(0, limit);
		return all
			.filter((digest) => {
				const haystack = digestSearchText(digest).toLowerCase();
				return terms.every((term) => haystack.includes(term));
			})
			.slice(0, limit);
	}

	/**
	 * The facts that currently stand, newest segment first. Superseded facts
	 * are left out: the page shows what is true now, and the history behind a
	 * statement is reachable from the segment it names.
	 */
	async facts(workspacePath: string): Promise<JournalFact[]> {
		const facts = await new FactStore(workspacePath).current();
		facts.sort((left, right) => right.id.localeCompare(left.id));
		return facts;
	}

	async readSettings(workspacePath?: string): Promise<DigestSettings> {
		return this.#settings.read(workspacePath);
	}

	/** Writes the default every workspace without an override falls back to. */
	async writeDefaults(settings: DigestSettings): Promise<DigestSettings> {
		await this.#settings.writeDefault(settings);
		return settings;
	}

	/**
	 * Writes one workspace's override, or clears it. Returns the settings that
	 * workspace now runs under, which is the override merged over the default.
	 */
	async writeOverride(
		workspacePath: string,
		override: DigestOverride | undefined,
	): Promise<DigestSettings> {
		await this.#settings.writeOverride(workspacePath, override);
		return this.#settings.read(workspacePath);
	}

	/** Starts a backfill unless one is already running for this workspace. */
	async startBackfill(
		workspacePath: string,
		regenerate = false,
	): Promise<MemoryStatus> {
		if (this.#running.has(workspacePath)) return this.status(workspacePath);

		const settings = await this.#settings.read(workspacePath);
		if (!settings.model) {
			throw new Error('Choose a digest model before backfilling memory.');
		}

		const controller = new AbortController();
		const entry: RunningBackfill = {
			controller,
			progress: { done: 0, total: 0, failed: 0, segment: '' },
			phase: 'digests',
		};
		this.#running.set(workspacePath, entry);

		const journal = new JournalStore(workspacePath);
		const digests = new DigestStore(workspacePath);
		const facts = new FactStore(workspacePath);
		const model = settings.model;

		// Detached on purpose: the request returns the starting status and the
		// UI polls, rather than holding a socket open for a run of minutes.
		void (async () => {
			try {
				const complete = await completeWithGizmoModel(model);
				await backfillDigests(
					{
						listSegments: async () =>
							(await journal.list()).map(({ id }) => id),
						readSegment: (id) => journal.read(id),
						digestedSegments: () => digests.segments(),
						writeDigest: (digest) => digests.write(digest),
					},
					model,
					complete,
					{
						regenerate,
						signal: controller.signal,
						onFailure: (segment, reason) =>
							console.error(`Memory digest failed for ${segment}:`, reason),
						onProgress: (progress) => {
							entry.progress = progress;
						},
					},
				);

				// Facts second, and only after every digest exists: the tier is
				// derived from digests, so building it against a half-filled
				// digest layer would bake the gaps in. Nothing here reruns a
				// segment whose facts are already on disk, so an interrupted run
				// resumes instead of paying for the whole history again.
				entry.phase = 'facts';
				entry.progress = { done: 0, total: 0, failed: 0, segment: '' };
				await buildFacts(
					{
						listDigests: () => digests.list(),
						listFacts: () => facts.list(),
						writeFacts: (written) => facts.write(written),
					},
					model,
					complete,
					{
						regenerate,
						signal: controller.signal,
						onFailure: (segment, reason) =>
							console.error(`Memory facts failed for ${segment}:`, reason),
						onProgress: (progress) => {
							entry.progress = {
								done: progress.done,
								total: progress.total,
								failed: progress.failed,
								segment: progress.segment,
								...(progress.error ? { error: progress.error } : {}),
							};
						},
					},
				);
			} catch (failure) {
				// Reaching here means the run never started -- typically an
				// unresolvable model -- so no progress callback carried a reason.
				const reason =
					failure instanceof Error ? failure.message : String(failure);
				entry.progress = { ...entry.progress, error: reason };
				console.error('Memory backfill failed:', reason);
				// Held briefly so a polling UI can read the reason before the
				// run disappears from the status.
				await new Promise((resolve) => setTimeout(resolve, 10_000));
			} finally {
				this.#running.delete(workspacePath);
			}
		})();

		return this.status(workspacePath);
	}

	async stopBackfill(workspacePath: string): Promise<MemoryStatus> {
		this.#running.get(workspacePath)?.controller.abort();
		return this.status(workspacePath);
	}
}
