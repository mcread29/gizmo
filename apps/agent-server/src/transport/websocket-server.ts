import { ProjectServiceRegistry } from '@gizmo/extensions';
import {
	WebSocketServer,
	type VerifyClientCallbackSync,
	type WebSocket,
} from 'ws';
import { ExtensionHostService } from '../extensions/extension-host-service';
import { PiAgentService } from '../sessions/pi-agent-service';
import {
	ProjectWatchCoordinator,
	type ProjectEmitters,
} from './project-watch-coordinator';
import { attachAgentConnection } from './websocket-connection';

export interface AgentWebSocketServerOptions {
	host?: string;
	port?: number;
	path?: string;
	allowedOrigins?: readonly string[];
	/**
	 * Factory seams for tests. Each factory is invoked once per server: the
	 * agent service, project services, and extension host are server-owned
	 * and outlive every individual connection.
	 */
	createService?: () => PiAgentService;
	createProjectServices?: () => ProjectServiceRegistry;
	createExtensionHost?: () => ExtensionHostService;
	/** Heartbeat cadence per connection; tests shorten it. */
	heartbeatIntervalMs?: number;
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

	// Server-owned resources: built once so a closed tab neither kills a
	// running agent nor forces the next tab to rebuild every runtime. The
	// session pool's own idle sweep and session cap govern their lifetime.
	const agent = options.createService?.() ?? new PiAgentService();
	const projectServices =
		options.createProjectServices?.() ?? new ProjectServiceRegistry([]);
	const extensions =
		options.createExtensionHost?.() ?? new ExtensionHostService([]);

	// Project events share the agent hub's sequence so connections see one
	// contiguous run of event ids; a private counter here would read as gaps.
	const emit: ProjectEmitters = {
		status: (sessionId, projectPath, extensionId, status) =>
			agent.events.emit(sessionId, {
				type: 'project.status.changed',
				projectPath,
				extensionId,
				status,
			}),
		extensions: (sessionId, projectPath, descriptors) =>
			agent.events.emit(sessionId, {
				type: 'project.extensions.changed',
				projectPath,
				extensions: descriptors,
			}),
	};
	const watchCoordinator = new ProjectWatchCoordinator(
		projectServices,
		extensions,
		emit,
	);

	server.on('connection', (socket) => {
		sockets.add(socket);
		attachAgentConnection(
			socket,
			{ agent, projectServices, extensions, watchCoordinator },
			options.heartbeatIntervalMs === undefined
				? {}
				: { heartbeatIntervalMs: options.heartbeatIntervalMs },
		);
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
				// Detach clients first so nothing races the disposals below. Their
				// sessions were server-owned, so they end here, not at tab close.
				for (const socket of sockets) socket.close(1001, 'Server closing');
				const shutdown = async () => {
					// Give in-flight turns a chance to stop cleanly before their
					// runtimes are torn down.
					try {
						await agent.abortStreamingSessions();
					} catch (error) {
						console.error('Error aborting streaming sessions:', error);
					}
					// A failure in one resource must not leak resources disposed
					// after it.
					for (const disposeOne of [
						() => agent.dispose(),
						() => projectServices.dispose(),
						() => extensions.dispose(),
					]) {
						try {
							disposeOne();
						} catch (error) {
							console.error('Error disposing agent session resource:', error);
						}
					}
					server.close((error) => {
						if (error) reject(error);
						else resolve();
					});
				};
				void shutdown();
			}),
	};
}

const defaultAllowedOrigins = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'tauri://localhost',
	'http://tauri.localhost',
];
