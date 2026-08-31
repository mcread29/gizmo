import { protocolVersion, type AgentEvent } from '@gizmo/protocol';
import type { TranslatedPiEvent } from './pi-event-translator';
import type { AgentEventListener } from './pi-agent-types';

type WithoutEventEnvelope<T> = T extends AgentEvent
	? Omit<T, 'protocolVersion' | 'eventId' | 'sessionId'>
	: never;
export type ServiceEvent = WithoutEventEnvelope<AgentEvent>;

/** Owns event sequencing independently of any one resident Pi runtime. */
export class AgentEventHub {
	readonly #listeners = new Set<AgentEventListener>();
	#eventId = 0;

	get lastEventId() {
		return this.#eventId;
	}

	subscribe(listener: AgentEventListener) {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	}

	emit(sessionId: string, event: ServiceEvent | TranslatedPiEvent) {
		const envelope = {
			...event,
			protocolVersion,
			eventId: ++this.#eventId,
			sessionId,
		} as AgentEvent;
		for (const listener of this.#listeners) listener(envelope);
	}

	clear() {
		this.#listeners.clear();
	}
}
