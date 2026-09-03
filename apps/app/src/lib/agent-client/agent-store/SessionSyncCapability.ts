import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import type { SessionCapability } from './SessionCapability';

/**
 * Keeps the open thread in line with the server when the event stream is
 * not to be trusted: ids that skip, a heartbeat naming an event this
 * connection never saw, or a reconnect. Every path ends in a quiet re-read
 * that leaves the screen alone.
 */
export class SessionSyncCapability {
	/** Newest event id seen on this connection; undefined until the first. */
	#lastEventId?: number;
	#resyncQueued = false;

	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
		private readonly sessions: SessionCapability,
	) {}

	/**
	 * Re-reads the open thread without clearing what is on screen, so nothing
	 * flashes, scrolls or loses focus. Events that arrive during the read are
	 * held and replayed past the snapshot's cutoff, as on a switch.
	 */
	async resync() {
		const store = this.store;
		const sessions = this.sessions;
		const sessionId = store.sessionId;
		if (!sessionId || store.connection !== 'connected') return;
		// A switch in progress already ends in a fresh snapshot.
		if (sessions.replay.sessionId) return;
		const selectionVersion = sessions.selectionVersion;
		const hold = sessions.replay.begin(sessionId);
		try {
			const snapshot = await this.client.resumeSession(sessionId);
			if (
				store.sessionId !== sessionId ||
				sessions.selectionVersion !== selectionVersion
			) {
				if (sessions.replay.owns(hold)) sessions.replay.discard(sessionId);
				return;
			}
			const session = store.sessions.find(({ id }) => id === sessionId);
			if (session) Object.assign(session, snapshot.session);
			store.messages = snapshot.messages;
			if (snapshot.state) store.sessionStates[sessionId] = snapshot.state;
			sessions.replay.release(
				sessionId,
				(event) => sessions.applyEvent(event),
				snapshot.lastEventId,
			);
			store.sessionState = store.sessionStates[sessionId] ?? store.sessionState;
		} catch {
			// The read failed; the held events are still the best news there is.
			if (sessions.replay.owns(hold)) {
				sessions.replay.release(sessionId, (event) =>
					sessions.applyEvent(event),
				);
			}
		}
	}

	/** Forgets the event sequence; the next connection starts its own. */
	resetSequence() {
		this.#lastEventId = undefined;
	}

	/**
	 * A heartbeat names the server's newest event id. Seeing a newer one than
	 * this connection ever received means events were lost on the way.
	 */
	noteHeartbeat(lastEventId: number) {
		if (this.#lastEventId !== undefined && lastEventId > this.#lastEventId) {
			this.#lastEventId = lastEventId;
			this.#queueResync();
		}
	}

	/** Called for every event received; a skipped id means some were lost. */
	noteEvent(eventId: number) {
		const previous = this.#lastEventId;
		if (previous !== undefined && eventId > previous + 1) this.#queueResync();
		if (previous === undefined || eventId > previous)
			this.#lastEventId = eventId;
	}

	#queueResync() {
		if (this.#resyncQueued) return;
		this.#resyncQueued = true;
		queueMicrotask(() => {
			this.#resyncQueued = false;
			void this.resync();
		});
	}
}
