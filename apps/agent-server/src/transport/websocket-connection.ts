import { heartbeatIntervalMs, protocolVersion } from '@gizmo/protocol';
import type { WebSocket } from 'ws';
import { sendMessage } from './protocol-messages';
import { handleRequestMessage } from './request-message-handler';
import type { RequestServices } from './request-router';

export interface AgentConnectionOptions {
	/** Heartbeat cadence; tests shorten it. Zero disables heartbeats. */
	heartbeatIntervalMs?: number;
}

/**
 * One browser connection is a subscriber of server-owned agent resources, not
 * their owner. Closing a tab only detaches the socket: sessions keep running,
 * a reopened tab reattaches to the same resident runtimes, and shared watches
 * and events keep reaching the tabs that remain.
 *
 * Events keep the ids the hub gave them rather than being renumbered per
 * connection: a snapshot's `lastEventId` cutoff and a client's gap detection
 * both compare against that one sequence, so every socket must see it.
 */
export function attachAgentConnection(
	socket: WebSocket,
	resources: RequestServices,
	options: AgentConnectionOptions = {},
): void {
	const unsubscribe = resources.agent.subscribe((event) =>
		sendMessage(socket, event),
	);
	const interval = options.heartbeatIntervalMs ?? heartbeatIntervalMs;
	const heartbeat =
		interval > 0
			? setInterval(() => {
					sendMessage(socket, {
						protocolVersion,
						type: 'heartbeat',
						lastEventId: resources.agent.events.lastEventId,
					});
				}, interval)
			: undefined;
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
	socket.once('close', () => {
		clearInterval(heartbeat);
		unsubscribe();
	});
}
