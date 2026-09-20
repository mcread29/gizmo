import { protocolVersion } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import { createConnectedClient } from './websocket-test-socket';

describe('WebSocketAgentClient projects', () => {
	it('validates project data returned by the server', async () => {
		const { client, socket } = await createConnectedClient();

		const projects = client.listProjects();
		expect(socket.sent[0]).toMatchObject({ type: 'project.list' });
		socket.receive({
			protocolVersion,
			requestId: 'request-1',
			type: 'response.success',
			result: [
				{
					title: 'Game',
					path: '/projects/game',
					integrations: [{ id: 'unity', root: '.' }],
					addedAt: 1,
				},
			],
		});

		await expect(projects).resolves.toEqual([
			{
				title: 'Game',
				path: '/projects/game',
				integrations: [{ id: 'unity', root: '.' }],
				addedAt: 1,
			},
		]);
	});

	it('subscribes the active session to project status changes', async () => {
		const { client, socket } = await createConnectedClient();

		const watching = client.watchProjectStatus(
			'session-1',
			'/projects/game',
			'unity',
		);
		expect(socket.sent[0]).toMatchObject({
			type: 'project.watch',
			sessionId: 'session-1',
			projectPath: '/projects/game',
			extensionId: 'unity',
		});
		socket.receive({
			protocolVersion,
			requestId: 'request-1',
			type: 'response.success',
			result: {
				// Status payloads are opaque extension-owned data in core.
				engine: 'unity',
				state: 'connected',
			},
		});

		await expect(watching).resolves.toMatchObject({ state: 'connected' });
	});

	it('sends project extension paths and validates the returned config', async () => {
		const { client, socket } = await createConnectedClient();

		const setting = client.setProjectExtensionPaths('/projects/game', [
			'/projects/game/tools/helper.ts',
		]);
		expect(socket.sent[0]).toMatchObject({
			type: 'project.extension-paths.set',
			projectPath: '/projects/game',
			paths: ['/projects/game/tools/helper.ts'],
		});
		socket.receive({
			protocolVersion,
			requestId: 'request-1',
			type: 'response.success',
			result: {
				version: 1,
				piExtensionPaths: ['/projects/game/tools/helper.ts'],
			},
		});

		await expect(setting).resolves.toEqual({
			version: 1,
			piExtensionPaths: ['/projects/game/tools/helper.ts'],
		});
	});
});
