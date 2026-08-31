import {
	parseAgentRequest,
	parseAgentResponse,
	protocolVersion,
	type AgentRequest,
	type AgentResponse,
} from '@gizmo/protocol';
import type {
	AgentDisconnectListener,
	AgentEventListener,
} from '../AgentClient';

interface PendingRequest {
	resolve(response: AgentResponse): void;
	reject(error: Error): void;
}

type SuccessfulAgentResponse = Extract<
	AgentResponse,
	{ type: 'response.success' }
>;

export type AgentRequestBody = AgentRequest extends infer Request
	? Request extends AgentRequest
		? Omit<Request, 'protocolVersion' | 'requestId'>
		: never
	: never;

const socketOpen = 1;
const socketClosed = 3;

export class WebSocketTransport {
	readonly #createSocket: (url: string) => WebSocket;
	readonly #listeners = new Set<AgentEventListener>();
	readonly #disconnectListeners = new Set<AgentDisconnectListener>();
	readonly #pending = new Map<string, PendingRequest>();
	#url: string;
	#socket?: WebSocket;
	#requestId = 0;

	constructor(url: string, createSocket: (url: string) => WebSocket) {
		this.#url = url;
		this.#createSocket = createSocket;
	}

	connect() {
		if (this.#socket?.readyState === socketOpen) return Promise.resolve();
		if (this.#socket) throw new Error('Agent connection is already opening');

		const socket = this.#createSocket(this.#url);
		this.#socket = socket;
		socket.addEventListener('message', this.#receive);
		socket.addEventListener('close', this.#closed);

		return new Promise<void>((resolve, reject) => {
			const opened = () => {
				cleanup();
				resolve();
			};
			const failed = () => {
				cleanup();
				this.#socket = undefined;
				reject(new Error(`Could not connect to Gizmo at ${this.#url}`));
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

	setEndpoint(url: string) {
		this.#url = url;
	}

	async disconnect() {
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

	request(body: AgentRequestBody) {
		const socket = this.#socket;
		if (!socket || socket.readyState !== socketOpen) {
			return Promise.reject<SuccessfulAgentResponse>(
				new Error('Agent client is not connected'),
			);
		}
		const requestId = `request-${++this.#requestId}`;
		const request = parseAgentRequest({
			...body,
			protocolVersion,
			requestId,
		});

		return new Promise<SuccessfulAgentResponse>((resolve, reject) => {
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

	subscribe(listener: AgentEventListener) {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	subscribeDisconnect(listener: AgentDisconnectListener) {
		this.#disconnectListeners.add(listener);
		return () => this.#disconnectListeners.delete(listener);
	}

	#receive = (message: MessageEvent) => {
		let input: unknown;
		try {
			input = JSON.parse(String(message.data));
		} catch {
			input = message.data;
		}

		if (isResponseCandidate(input)) {
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

	#rejectAll(error: Error) {
		for (const pending of this.#pending.values()) pending.reject(error);
		this.#pending.clear();
	}
}

function isResponseCandidate(input: unknown) {
	return (
		input !== null &&
		typeof input === 'object' &&
		'type' in input &&
		typeof input.type === 'string' &&
		input.type.startsWith('response.')
	);
}
