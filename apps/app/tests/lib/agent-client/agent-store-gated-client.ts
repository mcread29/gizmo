import {
	protocolVersion,
	type AgentEvent,
	type ProviderStatus,
	type SessionCatalog,
	type SessionSnapshot,
} from '@gizmo/protocol';
import type { AgentEventListener } from '../../../src/lib/agent-client/AgentClient';
import { InvalidEventClient } from './agent-store-invalid-client';

type InnerAgentEvent = AgentEvent extends infer Event
	? Event extends AgentEvent
		? Omit<Event, 'protocolVersion' | 'eventId' | 'sessionId'>
		: never
	: never;

export class GatedResumeClient extends InvalidEventClient {
	#listener?: AgentEventListener;
	#eventId = 0;
	#gate?: { id: string; promise: Promise<void>; release: () => void };

	snapshot: SessionSnapshot = {
		session: {
			id: 'session-a',
			title: 'First',
			createdAt: 0,
			lastActiveAt: 0,
			messageCount: 0,
		},
		messages: [],
	};
	#snapshots = new Map<string, SessionSnapshot>();

	/** Installs the snapshot resumeSession will return for a session. */
	setSnapshot(snapshot: SessionSnapshot): void {
		this.#snapshots.set(snapshot.session.id, snapshot);
	}

	snapshotFor(sessionId: string): SessionSnapshot {
		return this.#snapshots.get(sessionId) ?? this.snapshot;
	}

	/** Signals the store to buffer; returns the cutoff setter + release. */
	gate(id: string): { release(): void } {
		let release!: () => void;
		const promise = new Promise<void>((resolve) => (release = resolve));
		this.#gate = { id, promise, release };
		return { release };
	}

	async resumeSession(sessionId: string): Promise<SessionSnapshot> {
		const snapshot = this.#snapshots.get(sessionId) ?? this.snapshot;
		if (this.#gate?.id !== sessionId) return snapshot;
		const gate = this.#gate;
		this.#gate = undefined;
		await gate.promise;
		return snapshot;
	}

	emit(sessionId: string, event: InnerAgentEvent): void {
		this.#listener?.({
			...event,
			sessionId,
			protocolVersion,
			eventId: ++this.#eventId,
		} as AgentEvent);
	}

	/** The event id the next emit will carry, for setting the cutoff. */
	get nextEventId(): number {
		return this.#eventId + 1;
	}

	async connect() {}
	async disconnect() {}
	async listProviders(): Promise<ProviderStatus[]> {
		return [];
	}
	async reimportPiAuth(): Promise<ProviderStatus[]> {
		return [];
	}
	async listSessions(): Promise<SessionCatalog> {
		const sessions = [
			this.snapshot.session,
			...[...this.#snapshots.values()]
				.map(({ session }) => session)
				.filter(({ id }) => id !== this.snapshot.session.id),
		];
		return { sessions };
	}
	async createSession() {
		return 'session-a';
	}
	subscribe(listener: AgentEventListener) {
		this.#listener = listener;
		return () => (this.#listener = undefined);
	}
}
