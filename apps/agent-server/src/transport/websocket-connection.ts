import type { WebSocket } from 'ws';
import { sendMessage } from './protocol-messages';
import { handleRequestMessage } from './request-message-handler';
import type { RequestServices } from './request-router';

/**
 * One browser connection is a subscriber of server-owned agent resources, not
 * their owner. Closing a tab only detaches the socket: sessions keep running,
 * a reopened tab reattaches to the same resident runtimes, and shared watches
 * and events keep reaching the tabs that remain.
 */
export function attachAgentConnection(
	socket: WebSocket,
	resources: RequestServices,
): void {
	let eventId = 0;
	const unsubscribe = resources.agent.subscribe((event) =>
		sendMessage(socket, { ...event, eventId: ++eventId }),
	);
	socket.on('message', (data, isBinary) => {
		void handleRequestMessage(
			socket,
			resources,
			isBinary ? undefined : data.toString(),
		);
	});
	// An unhandled EventEmitter error would otherwise crash the process.
	socket.on('error', (error) => {
		console.error('Agent socket error:', error);
	});
	socket.once('close', () => unsubscribe());
}
