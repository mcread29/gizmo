import { installWebExtensions } from '../../extensions/runtime/install';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import type { SessionCapability } from './SessionCapability';
import { errorMessage } from './shared';

/** Backoff between automatic reconnects; the last entry repeats forever. */
const reconnectDelays = [500, 1_000, 2_000, 5_000, 10_000, 15_000];

export class ConnectionCapability {
	#unsubscribe?: () => void;
	#unsubscribeDisconnect?: () => void;
	#reconnectTimer?: ReturnType<typeof setTimeout>;
	#autoReconnect = true;

	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
		private readonly sessions: SessionCapability,
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
		this.#unsubscribe = this.client.subscribe((input) =>
			this.sessions.receive(input),
		);
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
			store.sessionId = undefined;
			store.messages = [];
			await store.refreshProjects();
			const catalog = await this.client.listSessions();
			store.sessions = catalog.sessions;
			store.sessionStates = Object.fromEntries(
				store.sessions.map((session) => [session.id, 'idle' as const]),
			);
			const session =
				store.sessions.find(({ id }) => id === resumeId) ??
				store.sessions.find(({ id }) => id === catalog.lastSessionId) ??
				store.sessions[0];
			if (session) await store.switchSession(session.id);
			else await store.newSession();
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

	#cleanupSubscriptions() {
		this.#unsubscribe?.();
		this.#unsubscribe = undefined;
		this.#unsubscribeDisconnect?.();
		this.#unsubscribeDisconnect = undefined;
	}
}
