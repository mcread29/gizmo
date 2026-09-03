import {
	heartbeatIntervalMs,
	isHeartbeat,
	parseHeartbeat,
} from '@gizmo/protocol';
import { installWebExtensions } from '../../extensions/runtime/install';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import type { SessionCapability } from './SessionCapability';
import type { SessionSyncCapability } from './SessionSyncCapability';
import { errorMessage } from './shared';

/** Backoff between automatic reconnects; the last entry repeats forever. */
const reconnectDelays = [500, 1_000, 2_000, 5_000, 10_000, 15_000];
/**
 * A socket that has been silent this long is treated as dead. Three missed
 * heartbeats: long enough to ride out a stall, short enough that a stuck
 * "streaming" composer does not outlive the user's patience.
 */
const silenceTimeoutMs = heartbeatIntervalMs * 3;
const silenceCheckMs = 5_000;

export class ConnectionCapability {
	#unsubscribe?: () => void;
	#unsubscribeDisconnect?: () => void;
	#reconnectTimer?: ReturnType<typeof setTimeout>;
	#autoReconnect = true;
	#lastMessageAt = 0;
	/** Armed by the first heartbeat, so servers that send none are left alone. */
	#silenceWatch?: ReturnType<typeof setInterval>;

	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
		private readonly sessions: SessionCapability,
		private readonly sync: SessionSyncCapability,
	) {}

	async connect() {
		const store = this.store;
		if (store.connection === 'connecting' || store.connection === 'connected') {
			return;
		}
		this.#autoReconnect = true;
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = undefined;
		store.connection =
			store.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
		store.error = undefined;
		this.sync.resetSequence();
		this.#unsubscribe = this.client.subscribe((input) => {
			this.#lastMessageAt = Date.now();
			if (!isHeartbeat(input)) {
				this.sessions.receive(input);
				return;
			}
			try {
				this.sync.noteHeartbeat(parseHeartbeat(input).lastEventId);
			} catch (error) {
				console.warn('Malformed heartbeat', error);
				return;
			}
			this.#armSilenceWatch();
		});
		this.#unsubscribeDisconnect = this.client.subscribeDisconnect((error) => {
			if (store.connection !== 'connected') return;
			store.connection = 'disconnected';
			store.error = { kind: 'connection', message: error.message };
			this.#cleanupSubscriptions();
			this.#scheduleReconnect();
		});
		const resumeId = store.sessionId;
		try {
			await this.client.connect();
			store.connection = 'connected';
			store.reconnectAttempt = 0;
			const diagnostics = await installWebExtensions(this.client);
			for (const diagnostic of diagnostics) console.warn(diagnostic);
			await store.refreshProjects();
			const catalog = await this.client.listSessions();
			store.sessions = catalog.sessions;
			store.sessionStates = Object.fromEntries(
				store.sessions.map((session) => [session.id, session.state ?? 'idle']),
			);
			const session =
				store.sessions.find(({ id }) => id === resumeId) ??
				store.sessions.find(({ id }) => id === catalog.lastSessionId) ??
				store.sessions[0];
			if (session && session.id === resumeId) {
				// A reconnect lands on the thread already on screen: refresh it in
				// place rather than blanking the transcript and reloading it.
				await this.sync.resync();
				await this.sessions.rebindSelection();
			} else {
				store.sessionId = undefined;
				store.messages = [];
				store.unsent = [];
				if (session) await store.switchSession(session.id);
				else await store.newSession();
			}
		} catch (error) {
			store.error = { kind: 'connection', message: errorMessage(error) };
			store.sessionId = resumeId;
			store.connection = 'disconnected';
			this.#cleanupSubscriptions();
			this.#scheduleReconnect();
		}
	}

	async reconnectTo(url: string) {
		if (!this.client.setEndpoint) return;
		await this.disconnect();
		this.client.setEndpoint(url);
		await this.reconnectNow();
	}

	async reconnectNow() {
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = undefined;
		this.store.reconnectAttempt = 0;
		if (this.store.connection === 'disconnected') await this.connect();
	}

	async disconnect() {
		this.#autoReconnect = false;
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = undefined;
		this.store.reconnectAttempt = 0;
		this.#cleanupSubscriptions();
		await this.client.disconnect();
		this.store.connection = 'disconnected';
	}

	#scheduleReconnect() {
		if (!this.#autoReconnect || this.#reconnectTimer !== undefined) return;
		const index = Math.min(
			this.store.reconnectAttempt,
			reconnectDelays.length - 1,
		);
		const delay = reconnectDelays[index]!;
		this.store.reconnectAttempt++;
		this.#reconnectTimer = setTimeout(() => {
			this.#reconnectTimer = undefined;
			void this.connect();
		}, delay);
	}

	#armSilenceWatch() {
		if (this.#silenceWatch !== undefined) return;
		this.#silenceWatch = setInterval(() => {
			if (Date.now() - this.#lastMessageAt < silenceTimeoutMs) return;
			// Closing the socket runs the ordinary disconnect path, which
			// reconnects with backoff and resyncs the open thread in place.
			this.#clearSilenceWatch();
			void this.client.disconnect();
		}, silenceCheckMs);
	}

	#clearSilenceWatch() {
		clearInterval(this.#silenceWatch);
		this.#silenceWatch = undefined;
	}

	#cleanupSubscriptions() {
		this.#clearSilenceWatch();
		this.#unsubscribe?.();
		this.#unsubscribe = undefined;
		this.#unsubscribeDisconnect?.();
		this.#unsubscribeDisconnect = undefined;
	}
}
