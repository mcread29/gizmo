import { protocolVersion, type AgentEvent } from '@unity-agent/protocol';
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
