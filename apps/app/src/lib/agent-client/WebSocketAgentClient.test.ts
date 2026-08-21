import { protocolVersion, type AgentEvent } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import { WebSocketAgentClient } from './WebSocketAgentClient';

class TestSocket extends EventTarget {
	readyState = 0;
	sent: unknown[] = [];

	open() {
		this.readyState = 1;
		this.dispatchEvent(new Event('open'));
	}

	receive(value: unknown) {
		this.dispatchEvent(
			new MessageEvent('message', { data: JSON.stringify(value) }),
		);
	}

	send(value: string) {
		this.sent.push(JSON.parse(value));
	}

	close() {
		this.readyState = 3;
		this.dispatchEvent(new Event('close'));
	}
}

describe('WebSocketAgentClient', () => {
	it('correlates request responses while forwarding streamed events', async () => {
		const socket = new TestSocket();
		const client = new WebSocketAgentClient({
			url: 'ws://agent.test/agent',
			createSocket: () => socket as unknown as WebSocket,
		});
		const events: unknown[] = [];
		client.subscribe((event) => events.push(event));

		const connecting = client.connect();
		socket.open();
		await connecting;

		const creating = client.createSession();
		expect(socket.sent[0]).toMatchObject({
			type: 'session.create',
			requestId: 'request-1',
		});
		socket.receive({
			protocolVersion,
			eventId: 1,
			sessionId: 'session-1',
			type: 'session.state',
			state: 'idle',
		} satisfies AgentEvent);
		socket.receive({
			protocolVersion,
			requestId: 'request-1',
			type: 'response.success',
			sessionId: 'session-1',
		});

		await expect(creating).resolves.toBe('session-1');
		expect(events).toHaveLength(1);
	});

	it('rejects a request when the server returns a structured error', async () => {
		const socket = new TestSocket();
		const client = new WebSocketAgentClient({
			url: 'ws://agent.test/agent',
			createSocket: () => socket as unknown as WebSocket,
		});
		const connecting = client.connect();
		socket.open();
		await connecting;

		const prompt = client.prompt('missing-session', 'Hello');
		socket.receive({
			protocolVersion,
			requestId: 'request-1',
			type: 'response.error',
			code: 'request_failed',
			message: 'Unknown session: missing-session',
		});

		await expect(prompt).rejects.toThrow('Unknown session');
	});

	it('sends attachments with prompts', async () => {
		const socket = new TestSocket();
		const client = new WebSocketAgentClient({
			url: 'ws://agent.test/agent',
			createSocket: () => socket as unknown as WebSocket,
		});
		const connecting = client.connect();
		socket.open();
		await connecting;

		const prompt = client.prompt('session-1', 'Inspect', undefined, [
			{ name: 'notes.txt', mimeType: 'text/plain', data: 'aGVsbG8=' },
		]);
		expect(socket.sent[0]).toMatchObject({
			type: 'session.prompt',
			attachments: [{ name: 'notes.txt', data: 'aGVsbG8=' }],
		});
		socket.receive({
			protocolVersion,
			requestId: 'request-1',
			type: 'response.success',
		});

		await expect(prompt).resolves.toBeUndefined();
	});

	it('reads attachments through their session-scoped id', async () => {
		const socket = new TestSocket();
		const client = new WebSocketAgentClient({
			url: 'ws://agent.test/agent',
			createSocket: () => socket as unknown as WebSocket,
		});
		const connecting = client.connect();
		socket.open();
		await connecting;

		const reading = client.readAttachment('session-1', 'attachment-1');
		expect(socket.sent[0]).toMatchObject({
			type: 'attachment.read',
			sessionId: 'session-1',
			attachmentId: 'attachment-1',
		});
		socket.receive({
			protocolVersion,
			requestId: 'request-1',
			type: 'response.success',
			result: {
				name: 'notes.txt',
				mimeType: 'text/plain',
				data: 'aGVsbG8=',
			},
		});

		await expect(reading).resolves.toMatchObject({ name: 'notes.txt' });
	});

	it('validates project data returned by the server', async () => {
		const socket = new TestSocket();
		const client = new WebSocketAgentClient({
			url: 'ws://agent.test/agent',
			createSocket: () => socket as unknown as WebSocket,
		});
		const connecting = client.connect();
		socket.open();
		await connecting;

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
		const socket = new TestSocket();
		const client = new WebSocketAgentClient({
			url: 'ws://agent.test/agent',
			createSocket: () => socket as unknown as WebSocket,
		});
		const connecting = client.connect();
		socket.open();
		await connecting;

		const watching = client.watchProjectStatus('session-1', '/projects/game');
		expect(socket.sent[0]).toMatchObject({
			type: 'project.watch',
			sessionId: 'session-1',
			projectPath: '/projects/game',
		});
		socket.receive({
			protocolVersion,
			requestId: 'request-1',
			type: 'response.success',
			result: {
				state: 'connected',
				ok: true,
				command: ['unity', 'status'],
				exitCode: 0,
				durationMs: 1,
				instances: [{ projectPath: '/projects/game' }],
				errors: [],
				warnings: [],
			},
		});

		await expect(watching).resolves.toMatchObject({ state: 'connected' });
	});

	it('validates persisted session catalogs and hydrated resumes', async () => {
		const socket = new TestSocket();
		const client = new WebSocketAgentClient({
			url: 'ws://agent.test/agent',
			createSocket: () => socket as unknown as WebSocket,
		});
		const connecting = client.connect();
		socket.open();
		await connecting;
		const session = {
			id: 'session-1',
			title: 'Saved session',
			projectPath: '/projects/game',
			createdAt: 1,
			lastActiveAt: 2,
			messageCount: 0,
		};

		const catalog = client.listSessions();
		socket.receive({
			protocolVersion,
			requestId: 'request-1',
			type: 'response.success',
			result: { sessions: [session], lastSessionId: session.id },
		});
		await expect(catalog).resolves.toMatchObject({
			lastSessionId: session.id,
		});

		const resume = client.resumeSession(session.id);
		socket.receive({
			protocolVersion,
			requestId: 'request-2',
			type: 'response.success',
			sessionId: session.id,
			result: { session, messages: [] },
		});
		await expect(resume).resolves.toEqual({ session, messages: [] });
	});

	it('gets and updates the active Pi model configuration', async () => {
		const socket = new TestSocket();
		const client = new WebSocketAgentClient({
			url: 'ws://agent.test/agent',
			createSocket: () => socket as unknown as WebSocket,
		});
		const connecting = client.connect();
		socket.open();
		await connecting;
		const result = {
			current: {
				provider: 'openai-codex',
				id: 'gpt-5.6-sol',
				thinkingLevel: 'high',
			},
			models: [
				{
					provider: 'openai-codex',
					id: 'gpt-5.6-sol',
					name: 'GPT-5.6 Sol',
					reasoning: true,
				},
			],
			thinkingLevels: ['low', 'high'],
		};

		const catalog = client.getModelCatalog('session-1');
		expect(socket.sent[0]).toMatchObject({
			type: 'model.catalog',
			sessionId: 'session-1',
		});
		socket.receive({
			protocolVersion,
			requestId: 'request-1',
			type: 'response.success',
			result,
		});
		await expect(catalog).resolves.toEqual(result);

		const thinking = client.selectThinkingLevel('session-1', 'low');
		expect(socket.sent[1]).toMatchObject({
			type: 'thinking.select',
			level: 'low',
		});
		socket.receive({
			protocolVersion,
			requestId: 'request-2',
			type: 'response.success',
			result: {
				...result,
				current: { ...result.current, thinkingLevel: 'low' },
			},
		});
		await expect(thinking).resolves.toMatchObject({
			current: { thinkingLevel: 'low' },
		});
	});

	it('reports an unexpected connection close', async () => {
		const socket = new TestSocket();
		const client = new WebSocketAgentClient({
			url: 'ws://agent.test/agent',
			createSocket: () => socket as unknown as WebSocket,
		});
		let disconnectError: Error | undefined;
		client.subscribeDisconnect((error) => (disconnectError = error));
		const connecting = client.connect();
		socket.open();
		await connecting;

		socket.close();

		expect(disconnectError?.message).toBe('Agent connection closed');
	});
});
