import type { AgentEvent } from '@gizmo/protocol';

/**
 * Holds a session's live events while a snapshot of it is being read, then
 * replays the ones newer than the snapshot. Without this a delta that lands
 * mid-read is either applied to the old transcript and lost when the snapshot
 * replaces it, or applied twice because the snapshot already contains it.
 */
export class EventReplay {
	#held?: { sessionId: string; events: AgentEvent[] };

	/** The session whose events are being held, if any. */
	get sessionId() {
		return this.#held?.sessionId;
	}

	/** Starts holding; returns a token that identifies this hold. */
	begin(sessionId: string): object {
		const held = { sessionId, events: [] };
		this.#held = held;
		return held;
	}

	/** Whether the hold identified by `token` is still the active one. */
	owns(token: object) {
		return this.#held === token;
	}

	/** Holds the event if its session is being read; true when it was held. */
	hold(event: AgentEvent) {
		if (this.#held?.sessionId !== event.sessionId) return false;
		this.#held.events.push(event);
		return true;
	}

	/** Applies held events newer than `cutoff` and stops holding. */
	release(
		sessionId: string,
		apply: (event: AgentEvent) => void,
		cutoff?: number,
	) {
		if (this.#held?.sessionId !== sessionId) return;
		const events = this.#held.events;
		this.#held = undefined;
		for (const event of events) {
			if (cutoff !== undefined && event.eventId <= cutoff) continue;
			apply(event);
		}
	}

	/** Stops holding without applying anything. */
	discard(sessionId: string) {
		if (this.#held?.sessionId === sessionId) this.#held = undefined;
	}
}
