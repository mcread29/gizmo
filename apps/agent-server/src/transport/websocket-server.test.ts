import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import type { PiAgentService } from '../sessions/pi-agent-service';
import { createAgentWebSocketServer, type AgentWebSocketServer } from './websocket-server';

function fakeService(dispose: () => void): PiAgentService {
	return {
		subscribe: () => () => {},
		dispose,
	} as unknown as PiAgentService;
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
			createProjectService: () => ({
				getStatus: () => Promise.reject(new Error('unused')),
				watchStatus: () => Promise.reject(new Error('unused')),
				openProject: () => Promise.reject(new Error('unused')),
				revertFile: () => Promise.reject(new Error('unused')),
				dispose: projectDispose,
			}),
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
});
