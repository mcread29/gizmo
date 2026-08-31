import type { ProjectService } from '@gizmo/extensions';
import {
	WebSocketServer,
	type VerifyClientCallbackSync,
	type WebSocket,
} from 'ws';
import type { ExtensionHostService } from '../extensions/extension-host-service';
import type { PiAgentService } from '../sessions/pi-agent-service';
import { attachAgentConnection } from './websocket-connection';

export interface AgentWebSocketServerOptions {
	host?: string;
	port?: number;
	path?: string;
	allowedOrigins?: readonly string[];
	createService?: () => PiAgentService;
	createProjectService?: () => ProjectService;
	createExtensionHost?: () => ExtensionHostService;
}

export interface AgentWebSocketServer {
	readonly server: WebSocketServer;
	close(): Promise<void>;
}

export async function createAgentWebSocketServer(
	options: AgentWebSocketServerOptions = {},
): Promise<AgentWebSocketServer> {
	const allowedOrigins = options.allowedOrigins ?? defaultAllowedOrigins;
	const verifyClient: VerifyClientCallbackSync = ({ origin }) => {
		// Non-browser clients have local system access and send no Origin.
		// Browsers on opaque origins send literal "null", which is untrusted.
		return !origin || (origin !== 'null' && allowedOrigins.includes(origin));
	};
	const server = new WebSocketServer({
		host: options.host ?? '127.0.0.1',
		port: options.port ?? 8787,
		path: options.path ?? '/agent',
		maxPayload: 32 * 1024 * 1024,
		verifyClient,
	});
	const sockets = new Set<WebSocket>();

	server.on('connection', (socket) => {
		sockets.add(socket);
		attachAgentConnection(socket, options);
		socket.once('close', () => sockets.delete(socket));
	});

	await new Promise<void>((resolve, reject) => {
		server.once('listening', resolve);
		server.once('error', reject);
	});

	return {
		server,
		close: () =>
			new Promise<void>((resolve, reject) => {
				for (const socket of sockets) socket.close(1001, 'Server closing');
				server.close((error) => {
					if (error) reject(error);
					else resolve();
				});
			}),
	};
}

const defaultAllowedOrigins = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'tauri://localhost',
	'http://tauri.localhost',
];
