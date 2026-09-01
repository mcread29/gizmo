import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { protocolVersion as PROTOCOL_VERSION } from '@gizmo/protocol';
import type { PiAgentService } from '../../src/sessions/pi-agent-service';
import { ProjectServiceRegistry, type ProjectService } from '@gizmo/extensions';
import {
	createAgentWebSocketServer,
	type AgentWebSocketServer,
} from '../../src/transport/websocket-server';

function fakeService(): PiAgentService {
	return {
		subscribe: () => () => {},
		dispose: () => {},
		abortStreamingSessions: async () => {},
	} as unknown as PiAgentService;
}

function stubProjectService(
	overrides: Partial<ProjectService> = {},
): ProjectService {
	return {
		getStatus: () => Promise.resolve(undefined),
		watchStatus: () => Promise.resolve(undefined),
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

/**
 * Protocol v26 project-service routing: services are registered per
 * extension id and requests name the extension they belong to.
 */
describe('project service routing', () => {
	let agentServer: AgentWebSocketServer | undefined;

	afterEach(async () => {
		await agentServer?.close();
		agentServer = undefined;
	});

	async function connect(port: number): Promise<WebSocket> {
		const socket = new WebSocket(`ws://127.0.0.1:${port}/agent`);
		await new Promise<void>((resolve, reject) => {
			socket.once('open', () => resolve());
			socket.once('error', reject);
		});
		return socket;
	}

	it('routes each request to the extension project service it names', async () => {
		const calls: string[] = [];
		agentServer = await createAgentWebSocketServer({
			port: 0,
			createService: () => fakeService(),
			createProjectServices: () =>
				new ProjectServiceRegistry([
					[
						'unity',
						stubProjectService({
							getStatus: async () => {
								calls.push('unity.status');
								return { engine: 'unity', editor: 'closed' };
							},
							openProject: async () => {
								calls.push('unity.open');
								return { engine: 'unity', state: 'opened' };
							},
						}),
					],
					[
						'unreal',
						stubProjectService({
							getStatus: async () => {
								calls.push('unreal.status');
								return { engine: 'unreal', editor: 'running' };
							},
							openProject: async () => {
								calls.push('unreal.open');
								return { engine: 'unreal', state: 'opened' };
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

		// Both extensions are registered, yet each request reaches only the
		// service it names — no first-service fallback decides the winner.
		const unityStatus = await request(socket, {
			type: 'project.status',
			projectPath: '/projects/game',
			extensionId: 'unity',
		});
		const unrealStatus = await request(socket, {
			type: 'project.status',
			projectPath: '/projects/game',
			extensionId: 'unreal',
		});
		const unrealOpen = await request(socket, {
			type: 'project.open',
			projectPath: '/projects/game',
			extensionId: 'unreal',
		});

		expect(unityStatus.result).toEqual({ engine: 'unity', editor: 'closed' });
		expect(unrealStatus.result).toEqual({
			engine: 'unreal',
			editor: 'running',
		});
		expect(unrealOpen.result).toEqual({ engine: 'unreal', state: 'opened' });
		expect(calls).toEqual(['unity.status', 'unreal.status', 'unreal.open']);

		// An unknown extension id fails loudly instead of falling back.
		const unknown = await request(socket, {
			type: 'project.status',
			projectPath: '/projects/game',
			extensionId: 'godot',
		});
		expect(unknown.type).toBe('response.error');
		expect(unknown.message).toContain('godot');
		socket.close();
	});

	it('tags status.changed events with the extension that produced them', async () => {
		let pushStatus: ((status: unknown) => void) | undefined;
		agentServer = await createAgentWebSocketServer({
			port: 0,
			createService: () => fakeService(),
			createProjectServices: () =>
				new ProjectServiceRegistry([
					[
						'unity',
						stubProjectService({
							watchStatus: (_path, listeners) => {
								pushStatus = listeners.status;
								return Promise.resolve({ engine: 'unity' });
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
		const events: Array<Record<string, unknown>> = [];
		socket.on('message', (data) => {
			const parsed = JSON.parse(data.toString());
			if (parsed.type === 'project.status.changed') events.push(parsed);
		});

		await request(socket, {
			type: 'project.watch',
			sessionId: 's1',
			projectPath: '/projects/game',
			extensionId: 'unity',
		});
		pushStatus?.({ engine: 'unity', editor: 'open' });
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: 'project.status.changed',
			projectPath: '/projects/game',
			extensionId: 'unity',
			status: { engine: 'unity', editor: 'open' },
		});
		socket.close();
	});

	it('routes v25 project requests without an extensionId to the first service', async () => {
		const calls: string[] = [];
		agentServer = await createAgentWebSocketServer({
			port: 0,
			createService: () => fakeService(),
			createProjectServices: () =>
				new ProjectServiceRegistry([
					[
						'unity',
						stubProjectService({
							getStatus: async () => {
								calls.push('unity.status');
								return { engine: 'unity' };
							},
						}),
					],
					[
						'unreal',
						stubProjectService({
							getStatus: async () => {
								calls.push('unreal.status');
								return { engine: 'unreal' };
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

		// v25 compatibility: the first registered service that answers wins,
		// exactly like the removed CompositeProjectService.
		const legacy = await new Promise<{
			type: string;
			result?: unknown;
			message?: string;
		}>((resolve, reject) => {
			const requestId = 'legacy-status';
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
					protocolVersion: 25,
					requestId,
					type: 'project.status',
					projectPath: '/projects/game',
				}),
			);
		});
		expect(legacy.result).toEqual({ engine: 'unity' });
		expect(calls).toEqual(['unity.status']);
		socket.close();
	});
});
