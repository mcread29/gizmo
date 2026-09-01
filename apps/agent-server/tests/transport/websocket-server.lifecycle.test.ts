import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { protocolVersion as PROTOCOL_VERSION } from '@gizmo/protocol';
import type { PiAgentService } from '../../src/sessions/pi-agent-service';
import {
	ProjectServiceRegistry,
	type ProjectService,
	type ProjectStatus,
} from '@gizmo/extensions';
import {
	createAgentWebSocketServer,
	type AgentWebSocketServer,
} from '../../src/transport/websocket-server';

function fakeService(
	dispose: () => void,
	abortStreamingSessions: () => Promise<void> = async () => {},
): PiAgentService {
	return {
		subscribe: () => () => {},
		dispose,
		abortStreamingSessions,
	} as unknown as PiAgentService;
}

/** A stub status payload; the shape is opaque extension-owned data in core. */
const unusedStatus = { marker: 'unused' } satisfies ProjectStatus;

function stubProjectService(
	overrides: Partial<ProjectService> = {},
): ProjectService {
	return {
		getStatus: () => Promise.resolve(unusedStatus),
		watchStatus: () => Promise.resolve(unusedStatus),
		openProject: () => Promise.resolve(undefined),
		revertFile: () => Promise.resolve(),
		dispose: () => {},
		...overrides,
	};
}

function request(
	socket: WebSocket,
	body: Record<string, unknown>,
): Promise<{ type: string; result?: unknown; message?: string }> {
	const requestId = `req-${Math.random().toString(36).slice(2)}`;
	return new Promise((resolve, reject) => {
		const onMessage = (data: WebSocket.RawData) => {
			try {
				const parsed = JSON.parse(data.toString());
				if (parsed.requestId === requestId) {
					socket.off('message', onMessage);
					resolve(parsed);
				}
			} catch (error) {
				reject(error);
			}
		};
		socket.on('message', onMessage);
		socket.send(
			JSON.stringify({
				protocolVersion: PROTOCOL_VERSION,
				requestId,
				...body,
			}),
		);
	});
}

let agentServer: AgentWebSocketServer | undefined;

afterEach(async () => {
	await agentServer?.close();
	agentServer = undefined;
});

describe('createAgentWebSocketServer', () => {
	it('disposes every session resource even when one throws', async () => {
		const projectDispose = vi.fn();
		agentServer = await createAgentWebSocketServer({
			port: 0,
			createService: () =>
				fakeService(() => {
					throw new Error('boom');
				}),
			createProjectServices: () =>
				new ProjectServiceRegistry([
					['unity', stubProjectService({ dispose: projectDispose })],
				]),
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const { port } = agentServer.server.address() as { port: number };
		const socket = new WebSocket(`ws://127.0.0.1:${port}/agent`);
		await new Promise<void>((resolve, reject) => {
			socket.once('open', () => resolve());
			socket.once('error', reject);
		});
		socket.close();
		await new Promise<void>((resolve) => socket.once('close', () => resolve()));
		// The close handler runs synchronously once the socket's 'close' event
		// fires on the server side; give the event loop a tick to catch up.
		await new Promise((resolve) => setTimeout(resolve, 20));

		// projectService.dispose() runs after service.dispose() throws — proof
		// the loop isolates each dispose rather than bailing on the first error.
		expect(projectDispose).toHaveBeenCalledOnce();
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('disposing'),
			expect.any(Error),
		);
		errorSpy.mockRestore();
	});

	it('aborts streaming sessions before disposing them on socket close', async () => {
		const order: string[] = [];
		agentServer = await createAgentWebSocketServer({
			port: 0,
			createService: () =>
				fakeService(
					() => void order.push('dispose'),
					async () => void order.push('abort'),
				),
		});

		const { port } = agentServer.server.address() as { port: number };
		const socket = new WebSocket(`ws://127.0.0.1:${port}/agent`);
		await new Promise<void>((resolve, reject) => {
			socket.once('open', () => resolve());
			socket.once('error', reject);
		});
		socket.close();
		await new Promise<void>((resolve) => socket.once('close', () => resolve()));
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(order).toEqual(['abort', 'dispose']);
	});

	it('reuses the live watch for a repeated project.watch on the same path', async () => {
		const watchCalls: string[] = [];
		const statusCalls: string[] = [];
		agentServer = await createAgentWebSocketServer({
			port: 0,
			createService: () => fakeService(() => {}),
			createProjectServices: () =>
				new ProjectServiceRegistry([
					[
						'unity',
						stubProjectService({
							getStatus: async (projectPath: string) => {
								statusCalls.push(projectPath);
								return { marker: 'idle' };
							},
							watchStatus: async (projectPath: string) => {
								watchCalls.push(projectPath);
								return { marker: 'watching' };
							},
						}),
					],
				]),
		});

		const { port } = agentServer.server.address() as { port: number };
		const socket = new WebSocket(`ws://127.0.0.1:${port}/agent`);
		await new Promise<void>((resolve, reject) => {
			socket.once('open', () => resolve());
			socket.once('error', reject);
		});

		const first = await request(socket, {
			type: 'project.watch',
			sessionId: 's1',
			projectPath: '/projects/game',
			extensionId: 'unity',
		});
		const second = await request(socket, {
			type: 'project.watch',
			sessionId: 's2',
			projectPath: '/projects/game',
			extensionId: 'unity',
		});

		// The second watch must not restart the underlying watch: it reports
		// current status instead, keeping the first watch's listeners alive.
		expect(watchCalls).toEqual(['/projects/game']);
		expect(statusCalls).toEqual(['/projects/game']);
		expect(first.type).toBe('response.success');
		expect(second.type).toBe('response.success');
		socket.close();
	});

	it('replaces the watch when a different project is watched', async () => {
		const watchCalls: string[] = [];
		agentServer = await createAgentWebSocketServer({
			port: 0,
			createService: () => fakeService(() => {}),
			createProjectServices: () =>
				new ProjectServiceRegistry([
					[
						'unity',
						stubProjectService({
							watchStatus: async (projectPath: string) => {
								watchCalls.push(projectPath);
								return { marker: 'watching' };
							},
						}),
					],
				]),
		});

		const { port } = agentServer.server.address() as { port: number };
		const socket = new WebSocket(`ws://127.0.0.1:${port}/agent`);
		await new Promise<void>((resolve, reject) => {
			socket.once('open', () => resolve());
			socket.once('error', reject);
		});

		await request(socket, {
			type: 'project.watch',
			sessionId: 's1',
			projectPath: '/projects/a',
			extensionId: 'unity',
		});
		await request(socket, {
			type: 'project.watch',
			sessionId: 's1',
			projectPath: '/projects/b',
			extensionId: 'unity',
		});

		expect(watchCalls).toEqual(['/projects/a', '/projects/b']);
		socket.close();
	});

	it('rejects a browser null origin like any other unlisted origin', async () => {
		agentServer = await createAgentWebSocketServer({
			port: 0,
			createService: () => fakeService(() => {}),
		});

		const { port } = agentServer.server.address() as { port: number };
		const socket = new WebSocket(`ws://127.0.0.1:${port}/agent`, {
			headers: { Origin: 'null' },
		});
		const rejection = await new Promise<Error>((resolve) => {
			socket.once('error', resolve);
			socket.once('open', () => resolve(new Error('unexpectedly opened')));
		});

		expect(rejection.message).toMatch(/40[13]|origin/i);
	});
});
