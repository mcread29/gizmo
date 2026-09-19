import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { afterEach, expect, it } from 'vitest';
import WebSocket from 'ws';
import { protocolVersion } from '@gizmo/protocol';
import {
	configureExtensionCatalog,
	rescanExtensionCatalog,
} from '../../src/extensions/extension-catalog';
import { configureExtensionReload } from '../../src/extensions/extension-reload';
import { registeredExtensions } from '../../src/extensions/registry';
import { AgentEventHub } from '../../src/sessions/agent-event-hub';
import type { PiAgentService } from '../../src/sessions/pi-agent-service';
import {
	createAgentWebSocketServer,
	type AgentWebSocketServer,
} from '../../src/transport/websocket-server';

let server: AgentWebSocketServer | undefined;
let root: string | undefined;
afterEach(async () => {
	await server?.close();
	if (root) await rm(root, { recursive: true, force: true });
});

it('reloads source over the socket and broadcasts the same generation to two clients without restarting', async () => {
	root = await mkdtemp(join(tmpdir(), 'gizmo-reload-wire-'));
	const source = join(root, 'fixture', 'index.ts');
	await mkdir(join(root, 'fixture'));
	await writeFile(
		source,
		`export const gizmoExtension = { id: 'fixture', name: 'before' };`,
	);
	configureExtensionCatalog({ linkedDir: root });
	await rescanExtensionCatalog();
	const events = new AgentEventHub();
	server = await createAgentWebSocketServer({
		port: 0,
		heartbeatIntervalMs: 0,
		createService: () =>
			({
				events,
				subscribe: events.subscribe.bind(events),
				abortStreamingSessions: async () => {},
				dispose: () => {},
			}) as unknown as PiAgentService,
	});
	configureExtensionReload({
		refreshProjectServices: () => {},
		reloadSessions: async () => ({ reloaded: ['idle'], pending: ['busy'] }),
		broadcast: (result) =>
			events.emit('server', {
				type: 'extensions.reloaded',
				generation: result.generation,
				extensions: result.extensions,
			}),
		uiChanged: () => {},
	});
	const address = server.server.address() as { port: number };
	const sockets = [0, 1].map(
		() => new WebSocket(`ws://127.0.0.1:${address.port}/agent`),
	);
	const messages: Array<Array<Record<string, any>>> = [[], []];
	for (const [index, socket] of sockets.entries())
		socket.on('message', (data) =>
			messages[index]!.push(JSON.parse(data.toString())),
		);
	await Promise.all(sockets.map((socket) => once(socket, 'open')));
	const pid = process.pid;
	await writeFile(
		source,
		(await readFile(source, 'utf8')).replace('before', 'after'),
	);
	sockets[0]!.send(
		JSON.stringify({
			protocolVersion,
			requestId: 'reload',
			type: 'extensions.reload',
		}),
	);
	await expect
		.poll(() =>
			messages.every((received) =>
				received.some(({ type }) => type === 'extensions.reloaded'),
			),
		)
		.toBe(true);
	await expect
		.poll(() => messages[0]!.some(({ requestId }) => requestId === 'reload'))
		.toBe(true);
	const first = messages[0]!.find(({ type }) => type === 'extensions.reloaded');
	expect(
		messages[1]!.find(({ type }) => type === 'extensions.reloaded'),
	).toEqual(first);
	expect(registeredExtensions()[0]?.name).toBe('after');
	expect(process.pid).toBe(pid);
	expect(sockets.every(({ readyState }) => readyState === WebSocket.OPEN)).toBe(
		true,
	);
	expect(
		messages[0]!.find(({ requestId }) => requestId === 'reload')?.result,
	).toMatchObject({ reloadedSessions: ['idle'], pendingSessions: ['busy'] });
	for (const socket of sockets) socket.close();
});
