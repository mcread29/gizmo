import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import {
	entriesSince,
	type JournalSegmentMeta,
	type JournalStore,
	type JournalTrigger,
} from './journal-store';

/**
 * The read-only slice of a session the recorder needs. Declared structurally
 * rather than imported: Pi's `ReadonlySessionManager` is not re-exported from
 * the package root, and narrowing to the two methods used keeps the recorder
 * testable without constructing a real session.
 */
export interface JournaledSession {
	getSessionId(): string;
	getBranch(fromId?: string): SessionEntry[];
}

export interface RecordOptions {
	trigger: JournalTrigger;
	/**
	 * First entry to leave out, exclusive. Compaction passes
	 * `firstKeptEntryId` so the segment ends exactly where the live context
	 * resumes; without it a later append would record those messages twice.
	 */
	until?: string;
}

export interface JournalRecorderOptions {
	/**
	 * Approximate size at which an idle session is journaled without waiting
	 * for a compaction or a clean shutdown. Neither of those is guaranteed to
	 * happen — a crash skips both — so this bounds how much an abandoned
	 * session can lose.
	 */
	thresholdBytes?: number;
}

const defaultThresholdBytes = 96_000;

/**
 * Decides when a span becomes a segment. Kept separate from JournalStore so
 * the triggering policy can be tested without a filesystem, and so the same
 * policy serves both the extension hooks and the session pool.
 */
export class JournalRecorder {
	readonly #store: JournalStore;
	readonly #thresholdBytes: number;

	constructor(store: JournalStore, options: JournalRecorderOptions = {}) {
		this.#store = store;
		this.#thresholdBytes = options.thresholdBytes ?? defaultThresholdBytes;
	}

	/** Journals everything recorded since this session's last segment. */
	async record(
		manager: JournaledSession,
		options: RecordOptions,
	): Promise<JournalSegmentMeta[]> {
		const sessionId = manager.getSessionId();
		const pending = await this.#pending(manager, options.until);
		if (pending.length === 0) return [];
		return this.#store.append(pending, {
			sessionId,
			trigger: options.trigger,
		});
	}

	/**
	 * Journals only once the un-journaled tail is large enough to be worth a
	 * segment, so a quiet session does not accumulate single-message files.
	 */
	async recordIfLarge(
		manager: JournaledSession,
	): Promise<JournalSegmentMeta[]> {
		const pending = await this.#pending(manager);
		if (approximateBytes(pending) < this.#thresholdBytes) return [];
		return this.#store.append(pending, {
			sessionId: manager.getSessionId(),
			trigger: 'threshold',
		});
	}

	async #pending(
		manager: JournaledSession,
		until?: string,
	): Promise<SessionEntry[]> {
		const branch = manager.getBranch();
		const pending = entriesSince(branch, await this.#store.resumeAfter(branch));
		return until ? takeUntil(pending, until) : pending;
	}
}

/** Entries up to but excluding `entryId`; all of them when it is not present. */
export function takeUntil(
	entries: readonly SessionEntry[],
	entryId: string,
): SessionEntry[] {
	const index = entries.findIndex((entry) => entry.id === entryId);
	return index < 0 ? [...entries] : entries.slice(0, index);
}

/** Cheap stand-in for token count — only the threshold comparison uses it. */
function approximateBytes(entries: readonly SessionEntry[]): number {
	let total = 0;
	for (const entry of entries) {
		if (entry.type !== 'message') continue;
		total += JSON.stringify(entry).length;
	}
	return total;
}
