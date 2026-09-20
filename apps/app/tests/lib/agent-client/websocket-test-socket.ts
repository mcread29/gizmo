import { WebSocketAgentClient } from '../../../src/lib/agent-client/WebSocketAgentClient';

export class TestSocket extends EventTarget implements WebSocket {
	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSING = 2;
	readonly CLOSED = 3;
	binaryType: BinaryType = 'blob';
	bufferedAmount = 0;
	extensions = '';
	onclose: WebSocket['onclose'] = null;
	onerror: WebSocket['onerror'] = null;
	onmessage: WebSocket['onmessage'] = null;
	onopen: WebSocket['onopen'] = null;
	protocol = '';
	readyState: WebSocket['readyState'] = this.CONNECTING;
	sent: unknown[] = [];
	url = 'ws://agent.test/agent';

	open() {
		this.readyState = this.OPEN;
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
		this.readyState = this.CLOSED;
		this.dispatchEvent(new Event('close'));
	}
}

export async function createConnectedClient() {
	const socket = new TestSocket();
	const client = new WebSocketAgentClient({
		url: socket.url,
		createSocket: () => socket,
	});
	const connecting = client.connect();
	socket.open();
	await connecting;
	return { client, socket };
}
