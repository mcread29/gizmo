import {
	parseAgentResponse,
	protocolVersion,
	type AgentRequest,
	type AgentResponse,
	type SessionOptions,
} from '@unity-agent/protocol';
import type {
	AgentClient,
	AgentDisconnectListener,
	AgentEventListener,
} from './AgentClient';

export interface WebSocketAgentClientOptions {
	url?: string;
	createSocket?: (url: string) => WebSocket;
}

interface PendingRequest {
	resolve(response: AgentResponse): void;
	reject(error: Error): void;
}

const socketOpen = 1;
const socketClosed = 3;

type AgentRequestBody = AgentRequest extends infer Request
	? Request extends AgentRequest
		? Omit<Request, 'protocolVersion' | 'requestId'>
		: never
	: never;

export class WebSocketAgentClient implements AgentClient {
	readonly #url: string;
	readonly #createSocket: (url: string) => WebSocket;
	readonly #listeners = new Set<AgentEventListener>();
	readonly #disconnectListeners = new Set<AgentDisconnectListener>();
	readonly #pending = new Map<string, PendingRequest>();
	#socket?: WebSocket;
	#requestId = 0;

	constructor(options: WebSocketAgentClientOptions = {}) {
		this.#url = options.url ?? defaultAgentUrl();
		this.#createSocket = options.createSocket ?? ((url) => new WebSocket(url));
	}

	connect(): Promise<void> {
		if (this.#socket?.readyState === socketOpen) return Promise.resolve();
		if (this.#socket) throw new Error('Agent connection is already opening');

		const socket = this.#createSocket(this.#url);
		this.#socket = socket;
		socket.addEventListener('message', this.#receive);
		socket.addEventListener('close', this.#closed);

		return new Promise((resolve, reject) => {
			const opened = () => {
				cleanup();
				resolve();
			};
			const failed = () => {
				cleanup();
				this.#socket = undefined;
				reject(new Error(`Could not connect to Unity Agent at ${this.#url}`));
			};
			const cleanup = () => {
				socket.removeEventListener('open', opened);
				socket.removeEventListener('error', failed);
				socket.removeEventListener('close', failed);
			};
			socket.addEventListener('open', opened);
			socket.addEventListener('error', failed, { once: true });
			socket.addEventListener('close', failed, { once: true });
		});
	}

	async disconnect(): Promise<void> {
		const socket = this.#socket;
		if (!socket) return;
		if (socket.readyState === socketClosed) {
			this.#closed();
			return;
		}
		await new Promise<void>((resolve) => {
			socket.addEventListener('close', () => resolve(), { once: true });
			socket.close(1000, 'Client disconnecting');
		});
	}

	async createSession(options: SessionOptions = {}): Promise<string> {
		const response = await this.#request({ type: 'session.create', options });
		if (!response.sessionId) {
			throw new Error('Agent server did not return a session ID');
		}
		return response.sessionId;
	}

	async prompt(sessionId: string, text: string): Promise<void> {
		await this.#request({ type: 'session.prompt', sessionId, text });
	}

	async steer(sessionId: string, text: string): Promise<void> {
		await this.#request({ type: 'session.steer', sessionId, text });
	}

	async abort(sessionId: string): Promise<void> {
		await this.#request({ type: 'session.abort', sessionId });
	}

	subscribe(listener: AgentEventListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	subscribeDisconnect(listener: AgentDisconnectListener): () => void {
		this.#disconnectListeners.add(listener);
		return () => this.#disconnectListeners.delete(listener);
	}

	#request(
		body: AgentRequestBody,
	): Promise<Extract<AgentResponse, { type: 'response.success' }>> {
		const socket = this.#socket;
		if (!socket || socket.readyState !== socketOpen) {
			return Promise.reject(new Error('Agent client is not connected'));
		}
		const requestId = `request-${++this.#requestId}`;
		const request = { ...body, protocolVersion, requestId } as AgentRequest;

		return new Promise((resolve, reject) => {
			this.#pending.set(requestId, {
				resolve: (response) => {
					if (response.type === 'response.error') {
						reject(new Error(response.message));
					} else {
						resolve(response);
					}
				},
				reject,
			});
			socket.send(JSON.stringify(request));
		});
	}

	#receive = (message: MessageEvent) => {
		let input: unknown;
		try {
			input = JSON.parse(String(message.data));
		} catch {
			input = message.data;
		}

		if (
			input &&
			typeof input === 'object' &&
			'type' in input &&
			typeof input.type === 'string' &&
			input.type.startsWith('response.')
		) {
			let response: AgentResponse;
			try {
				response = parseAgentResponse(input);
			} catch (error) {
				this.#rejectAll(
					error instanceof Error ? error : new Error(String(error)),
				);
				return;
			}
			const pending = this.#pending.get(response.requestId);
			if (pending) {
				this.#pending.delete(response.requestId);
				pending.resolve(response);
			}
			return;
		}

		for (const listener of this.#listeners) listener(input);
	};

	#closed = () => {
		if (!this.#socket) return;
		this.#socket = undefined;
		const error = new Error('Agent connection closed');
		this.#rejectAll(error);
		for (const listener of this.#disconnectListeners) listener(error);
	};

	#rejectAll(error: Error): void {
		for (const pending of this.#pending.values()) pending.reject(error);
		this.#pending.clear();
	}
}

function defaultAgentUrl(): string {
	const url = new URL('/agent', window.location.href);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.href;
}
