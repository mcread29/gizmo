import { parseAgentEvent, protocolVersion } from '@gizmo/protocol';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { PiAgentService } from '../../src/sessions/pi-agent-service';
import { PiSessionRepository } from '../../src/sessions/session-repository';
import {
	createAgentWebSocketServer,
	type AgentWebSocketServer,
} from '../../src/transport/websocket-server';
import {
	createTemporaryDirectory,
	FakePiSession,
} from '../sessions/support/pi-agent-service-fixtures';

const runningServers: AgentWebSocketServer[] = [];
const openSockets: WebSocket[] = [];

afterEach(async () => {
	for (const socket of openSockets.splice(0)) socket.close();
	await Promise.all(runningServers.splice(0).map((server) => server.close()));
});

describe('agent WebSocket server heartbeat', () => {
	it('sends heartbeats naming the newest event id', async () => {
		const server = await start({ heartbeatIntervalMs: 20 });
		const socket = await connect(server);

		const first = await receive(socket, (m) => m.type === 'heartbeat');
		expect(first).toEqual({
			protocolVersion,
			type: 'heartbeat',
			lastEventId: 0,
		});

		const created = receive(socket, (m) => m.type === 'session.created');
		const response = receive(socket, (m) => m.requestId === 'create-1');
		socket.send(
			JSON.stringify({
				protocolVersion,
				requestId: 'create-1',
				type: 'session.create',
				options: {},
			}),
		);
		const createdEvent = parseAgentEvent(await created);
		await response;
		const later = await receive(
			socket,
			(m) =>
				m.type === 'heartbeat' &&
				(m.lastEventId as number) >= createdEvent.eventId,
		);
		expect(later.lastEventId).toBeGreaterThanOrEqual(createdEvent.eventId);
	});

	it('gives every connection the same event ids', async () => {
		const server = await start();
		const first = await connect(server);
		const second = await connect(server);

		const seenByFirst = receive(first, (m) => m.type === 'session.created');
		const seenBySecond = receive(second, (m) => m.type === 'session.created');
		// The response lands after the session file is written, so waiting for
		// it keeps teardown from removing the data dir underneath the write.
		const response = receive(first, (m) => m.requestId === 'create-1');
		first.send(
			JSON.stringify({
				protocolVersion,
				requestId: 'create-1',
				type: 'session.create',
				options: {},
			}),
		);
		const [a, b] = await Promise.all([seenByFirst, seenBySecond]);
		await response;
		// A per-socket counter would number these independently; a snapshot's
		// lastEventId cutoff only means something against one shared sequence.
		expect(a.eventId).toBe(b.eventId);
	});
});

async function start(options: { heartbeatIntervalMs?: number } = {}) {
	const pi = new FakePiSession();
	const dataDir = await createTemporaryDirectory();
	const server = await createAgentWebSocketServer({
		port: 0,
		createService: () =>
			new PiAgentService(async (_options, manager) => {
				pi.sessionId = manager.getSessionId();
				return pi;
			}, new PiSessionRepository(dataDir)),
		...options,
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
