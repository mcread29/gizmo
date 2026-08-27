const storageKey = 'gizmo.drafts.v1';

/**
 * Unsent composer text, kept per thread and across restarts. Switching threads
 * to check something should not cost you the message you were composing.
 *
 * Owned by the shell rather than exported as a singleton, so its reactive state
 * belongs to the component tree that reads it.
 */
export class DraftStore {
	#drafts = $state<Record<string, string>>({});
	readonly #storage: Storage | undefined;

	constructor(storage = browserStorage()) {
		this.#storage = storage;
		try {
			const stored = JSON.parse(storage?.getItem(storageKey) ?? 'null');
			if (stored && typeof stored === 'object') this.#drafts = stored;
		} catch {
			// A corrupt draft is not worth failing a launch over.
		}
	}

	get(sessionId: string | undefined): string {
		return this.#drafts[key(sessionId)] ?? '';
	}

	set(sessionId: string | undefined, value: string): void {
		if (value) this.#drafts[key(sessionId)] = value;
		else delete this.#drafts[key(sessionId)];
		this.#persist();
	}

	/**
	 * Moves text typed before a thread existed onto that thread. Without this,
	 * anything written while the first session is still being created is lost.
	 */
	adopt(sessionId: string): void {
		const pending = this.#drafts[unassigned];
		if (!pending || this.#drafts[sessionId]) return;
		delete this.#drafts[unassigned];
		this.#drafts[sessionId] = pending;
		this.#persist();
	}

	clear(sessionId: string | undefined): void {
		this.set(sessionId, '');
	}

	#persist(): void {
		try {
			this.#storage?.setItem(storageKey, JSON.stringify(this.#drafts));
		} catch {
			// Storage may be unavailable in a restricted webview.
		}
	}
}

const unassigned = 'unassigned';

function key(sessionId: string | undefined): string {
	return sessionId ?? unassigned;
}

function browserStorage(): Storage | undefined {
	return typeof localStorage === 'undefined' ? undefined : localStorage;
}
