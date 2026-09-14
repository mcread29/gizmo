import type { PiSessionCallbacks } from './pi-agent-types';

/**
 * Pending stop-play-mode confirmations awaiting the client's answer. Each
 * request is keyed by id and bound to the session that asked, so a reply
 * cannot resolve another session's dialog.
 */
export class ConfirmationRegistry {
	readonly #pending = new Map<
		string,
		{ sessionId: string; resolve: (accepted: boolean) => void }
	>();
	#nextId = 0;

	/**
	 * Opens a confirmation and hands the id to `request`, which delivers it
	 * to the client. Resolves with the client's answer.
	 */
	create(
		sessionId: string,
		request: (confirmationId: string) => void,
	): Promise<boolean> {
		return new Promise((resolve) => {
			const confirmationId = `confirmation-${++this.#nextId}`;
			this.#pending.set(confirmationId, { sessionId, resolve });
			request(confirmationId);
		});
	}

	resolve(sessionId: string, confirmationId: string, accepted: boolean) {
		const pending = this.#pending.get(confirmationId);
		if (!pending || pending.sessionId !== sessionId) {
			throw new Error(`Unknown confirmation: ${confirmationId}`);
		}
		this.#pending.delete(confirmationId);
		pending.resolve(accepted);
	}

	/** Answers every open confirmation for a session with "no". */
	cancelAll(sessionId: string) {
		for (const [id, pending] of this.#pending) {
			if (pending.sessionId !== sessionId) continue;
			this.#pending.delete(id);
			pending.resolve(false);
		}
	}

	/** Answers every open confirmation with "no"; used when shutting down. */
	dispose() {
		for (const { resolve } of this.#pending.values()) resolve(false);
		this.#pending.clear();
	}
}
