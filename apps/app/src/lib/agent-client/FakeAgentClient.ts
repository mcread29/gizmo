import {
	protocolVersion,
	type AgentEvent,
	type SessionOptions,
} from '@unity-agent/protocol';
import type {
	AgentClient,
	AgentDisconnectListener,
	AgentEventListener,
} from './AgentClient';

interface FakeSession {
	abortController?: AbortController;
	running: boolean;
}

type WithoutEventEnvelope<T> = T extends AgentEvent
	? Omit<T, 'protocolVersion' | 'eventId'>
	: never;
type EmittedAgentEvent = WithoutEventEnvelope<AgentEvent>;

export interface FakeAgentClientOptions {
	latencyMs?: number;
}

export class FakeAgentClient implements AgentClient {
	readonly #latencyMs: number;
	readonly #listeners = new Set<AgentEventListener>();
	readonly #disconnectListeners = new Set<AgentDisconnectListener>();
	readonly #sessions = new Map<string, FakeSession>();
	#connected = false;
	#eventId = 0;
	#id = 0;

	constructor(options: FakeAgentClientOptions = {}) {
		this.#latencyMs = options.latencyMs ?? 90;
	}

	async connect(): Promise<void> {
		this.#connected = true;
	}

	async disconnect(): Promise<void> {
		for (const session of this.#sessions.values())
			session.abortController?.abort();
		this.#sessions.clear();
		this.#connected = false;
		for (const listener of this.#disconnectListeners) {
			listener(new Error('Agent connection closed'));
		}
	}

	async createSession(_options: SessionOptions = {}): Promise<string> {
		this.#assertConnected();
		const sessionId = `session-${++this.#id}`;
		this.#sessions.set(sessionId, { running: false });
		this.#emit({ type: 'session.created', sessionId, title: 'New session' });
		this.#emit({ type: 'session.state', sessionId, state: 'idle' });
		return sessionId;
	}

	async prompt(sessionId: string, text: string): Promise<void> {
		const session = this.#getSession(sessionId);
		if (session.running) throw new Error('Session is already streaming');

		const abortController = new AbortController();
		session.abortController = abortController;
		session.running = true;

		const userMessageId = `message-${++this.#id}`;
		this.#emit({
			type: 'message.started',
			sessionId,
			messageId: userMessageId,
			role: 'user',
			createdAt: Date.now(),
		});
		this.#emit({
			type: 'message.delta',
			sessionId,
			messageId: userMessageId,
			delta: text,
		});
		this.#emit({
			type: 'message.completed',
			sessionId,
			messageId: userMessageId,
		});
		this.#emit({ type: 'session.state', sessionId, state: 'streaming' });

		const assistantMessageId = `message-${++this.#id}`;
		this.#emit({
			type: 'message.started',
			sessionId,
			messageId: assistantMessageId,
			role: 'assistant',
			createdAt: Date.now(),
		});

		try {
			for (const delta of [
				'I’ll inspect the connected Editor, ',
				'then check the active project state.',
			]) {
				if (!(await this.#wait(abortController.signal))) return;
				this.#emit({
					type: 'message.delta',
					sessionId,
					messageId: assistantMessageId,
					delta,
				});
			}

			const toolCallId = `tool-${++this.#id}`;
			if (!(await this.#wait(abortController.signal))) return;
			this.#emit({
				type: 'tool.started',
				sessionId,
				messageId: assistantMessageId,
				toolCallId,
				toolName: 'unity_status',
				input: {},
			});
			if (!(await this.#wait(abortController.signal))) return;
			this.#emit({
				type: 'tool.updated',
				sessionId,
				toolCallId,
				message: 'Connecting to Unity Editor',
			});
			if (!(await this.#wait(abortController.signal))) return;
			this.#emit({
				type: 'tool.completed',
				sessionId,
				toolCallId,
				result: {
					state: 'connected',
					ok: true,
					exitCode: 0,
					instances: [
						{
							projectPath: '/projects/ThirdPersonSandbox',
							version: '6000.3.7f1',
							port: 6400,
							pid: 42,
							state: 'ready',
						},
					],
					errors: [],
					warnings: [],
				},
				isError: false,
			});
			if (!(await this.#wait(abortController.signal))) return;
			this.#emit({
				type: 'message.delta',
				sessionId,
				messageId: assistantMessageId,
				delta: ' The Editor is connected and ready for commands.',
			});
		} finally {
			this.#emit({
				type: 'message.completed',
				sessionId,
				messageId: assistantMessageId,
			});
			this.#emit({ type: 'session.state', sessionId, state: 'idle' });
			session.abortController = undefined;
			session.running = false;
		}
	}

	async steer(sessionId: string, text: string): Promise<void> {
		await this.abort(sessionId);
		await this.prompt(sessionId, text);
	}

	async abort(sessionId: string): Promise<void> {
		this.#getSession(sessionId).abortController?.abort();
	}

	subscribe(listener: AgentEventListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	subscribeDisconnect(listener: AgentDisconnectListener): () => void {
		this.#disconnectListeners.add(listener);
		return () => this.#disconnectListeners.delete(listener);
	}

	#assertConnected(): void {
		if (!this.#connected) throw new Error('Agent client is not connected');
	}

	#getSession(sessionId: string): FakeSession {
		this.#assertConnected();
		const session = this.#sessions.get(sessionId);
		if (!session) throw new Error(`Unknown session: ${sessionId}`);
		return session;
	}

	#emit(event: EmittedAgentEvent): void {
		const envelope = {
			...event,
			protocolVersion,
			eventId: ++this.#eventId,
		} as AgentEvent;
		for (const listener of this.#listeners) listener(envelope);
	}

	#wait(signal: AbortSignal): Promise<boolean> {
		return new Promise((resolve) => {
			if (signal.aborted) return resolve(false);
			const timeout = window.setTimeout(() => {
				signal.removeEventListener('abort', onAbort);
				resolve(true);
			}, this.#latencyMs);
			const onAbort = () => {
				window.clearTimeout(timeout);
				resolve(false);
			};
			signal.addEventListener('abort', onAbort, { once: true });
		});
	}
}
