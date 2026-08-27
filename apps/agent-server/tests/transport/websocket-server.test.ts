import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import {
	parseAgentEvent,
	parseAgentResponse,
	protocolVersion,
	type AgentResponse,
} from '@gizmo/protocol';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import {
	PiAgentService,
	type PiSessionLike,
} from '../../src/sessions/pi-agent-service';
import { PiSessionRepository } from '../../src/sessions/session-repository';
import {
	createAgentWebSocketServer,
	type AgentWebSocketServer,
} from '../../src/transport/websocket-server';

class StreamingPiSession implements PiSessionLike {
	sessionId = 'pi-session-1';
	sessionName = 'New session';
	readonly model = { provider: 'test-provider', id: 'test-model' };
	readonly thinkingLevel = 'low';
	readonly steer = vi.fn(async () => {});
	readonly abort = vi.fn(async () => {});
	readonly setSessionName = vi.fn((name: string) => (this.sessionName = name));
	readonly dispose = vi.fn();
	#listener?: (event: AgentSessionEvent) => void;

	subscribe(listener: (event: AgentSessionEvent) => void) {
		this.#listener = listener;
		return () => (this.#listener = undefined);
	}

	async prompt(text: string) {
		this.#emit({ type: 'agent_start' });
		this.#emit({
			type: 'message_start',
			message: { role: 'user', content: text, timestamp: 1 },
		});
		this.#emit({
			type: 'message_end',
			message: { role: 'user', content: text, timestamp: 1 },
		});
		const assistant = {
			role: 'assistant',
			content: [],
			timestamp: 2,
			api: 'openai-responses',
			provider: 'test-provider',
			model: 'test-model',
			usage: {},
			stopReason: 'stop',
		};
		this.#emit({ type: 'message_start', message: assistant });
		this.#emit({
			type: 'message_update',
			message: assistant,
			assistantMessageEvent: {
				type: 'text_delta',
				delta: 'Real transport response',
				contentIndex: 0,
				partial: assistant,
			},
		});
		this.#emit({ type: 'message_end', message: assistant });
		this.#emit({ type: 'agent_settled' });
	}

	#emit(event: unknown) {
		this.#listener?.(event as AgentSessionEvent);
	}
}

const runningServers: AgentWebSocketServer[] = [];
const openSockets: WebSocket[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
	for (const socket of openSockets.splice(0)) socket.close();
	await Promise.all(runningServers.splice(0).map((server) => server.close()));
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe('agent WebSocket server', () => {
	it('correlates requests and streams Pi events over one connection', async () => {
		const pi = new StreamingPiSession();
		const dataDir = await mkdtemp(join(tmpdir(), 'gizmo-test-'));
		temporaryDirectories.push(dataDir);
		const server = await start(
			() =>
				new PiAgentService(async (_options, manager) => {
					pi.sessionId = manager.getSessionId();
					return pi;
				}, new PiSessionRepository(dataDir)),
		);
		const socket = await connect(server);

		const createdMessage = receive(
			socket,
			(message) => message.type === 'session.created',
		);
		const createResult = receive(
			socket,
			(message) => message.requestId === 'create-1',
		);
		socket.send(
			JSON.stringify({
				protocolVersion,
				requestId: 'create-1',
				type: 'session.create',
				options: {},
			}),
		);
		const created = parseAgentEvent(await createdMessage);
		const createResponse = parseAgentResponse(await createResult);

		expect(created).toMatchObject({
			type: 'session.created',
			model: {
				provider: 'test-provider',
				id: 'test-model',
				thinkingLevel: 'low',
			},
		});
		expect(createResponse).toMatchObject({
			type: 'response.success',
			sessionId: pi.sessionId,
		});

		const deltaMessage = receive(
			socket,
			(message) => message.type === 'message.delta',
		);
		const promptResult = receive(
			socket,
			(message) => message.requestId === 'prompt-1',
		);
		socket.send(
			JSON.stringify({
				protocolVersion,
				requestId: 'prompt-1',
				type: 'session.prompt',
				sessionId: pi.sessionId,
				text: 'Hello',
			}),
		);
		const delta = parseAgentEvent(await deltaMessage);
		const promptResponse = parseAgentResponse(await promptResult);

		expect(delta).toMatchObject({
			type: 'message.delta',
			delta: 'Hello',
		});
		expect(promptResponse.type).toBe('response.success');
	});

	it('returns structured errors without closing the connection', async () => {
		const server = await start(() => new PiAgentService());
		const socket = await connect(server);

		const errorMessage = receive(
			socket,
			(message) => message.requestId === 'bad-1',
		);
		socket.send(
			JSON.stringify({
				protocolVersion,
				requestId: 'bad-1',
				type: 'unknown',
			}),
		);
		const response = parseAgentResponse(await errorMessage);

		expect(response).toMatchObject({
			type: 'response.error',
			code: 'invalid_request',
		});
		expect(socket.readyState).toBe(WebSocket.OPEN);
	});

	it('rejects browser connections from an untrusted origin', async () => {
		const server = await start(() => new PiAgentService());
		const { port } = server.server.address() as AddressInfo;
		const socket = new WebSocket(`ws://127.0.0.1:${port}/agent`, {
			origin: 'https://malicious.example',
		});

		await expect(
			new Promise<void>((resolve, reject) => {
				socket.once('open', resolve);
				socket.once('error', reject);
			}),
		).rejects.toThrow('Unexpected server response: 401');
	});
});

async function start(createService: () => PiAgentService) {
	const server = await createAgentWebSocketServer({
		port: 0,
		createService,
	});
	runningServers.push(server);
	return server;
}

async function connect(server: AgentWebSocketServer): Promise<WebSocket> {
	const { port } = server.server.address() as AddressInfo;
	const socket = new WebSocket(`ws://127.0.0.1:${port}/agent`);
	openSockets.push(socket);
	await new Promise<void>((resolve, reject) => {
		socket.once('open', resolve);
		socket.once('error', reject);
	});
	return socket;
}

function receive(
	socket: WebSocket,
	predicate: (message: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const onMessage = (data: WebSocket.RawData) => {
			try {
				const message = JSON.parse(data.toString()) as Record<string, unknown>;
				if (!predicate(message)) return;
				socket.off('message', onMessage);
				resolve(message);
			} catch (error) {
				reject(error);
			}
		};
		socket.on('message', onMessage);
	});
}
