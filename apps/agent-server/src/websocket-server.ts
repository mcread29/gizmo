import {
	parseAgentRequest,
	protocolVersion,
	type AgentRequest,
	type AgentResponse,
} from '@unity-agent/protocol';
import { WebSocket, WebSocketServer, type VerifyClientCallbackSync } from 'ws';
import { PiAgentService } from './pi-agent-service';
import { UnityProjectService } from './unity-project-service';

export interface AgentWebSocketServerOptions {
	host?: string;
	port?: number;
	path?: string;
	allowedOrigins?: readonly string[];
	createService?: () => PiAgentService;
	createProjectService?: () => UnityProjectService;
}

export interface AgentWebSocketServer {
	readonly server: WebSocketServer;
	close(): Promise<void>;
}

export async function createAgentWebSocketServer(
	options: AgentWebSocketServerOptions = {},
): Promise<AgentWebSocketServer> {
	const verifyClient: VerifyClientCallbackSync = ({ origin }) =>
		!origin ||
		(options.allowedOrigins ?? defaultAllowedOrigins).includes(origin);
	const server = new WebSocketServer({
		host: options.host ?? '127.0.0.1',
		port: options.port ?? 8787,
		path: options.path ?? '/agent',
		maxPayload: 1024 * 1024,
		verifyClient,
	});
	const services = new Map<
		WebSocket,
		{ agent: PiAgentService; projects: UnityProjectService }
	>();

	server.on('connection', (socket) => {
		const service = options.createService?.() ?? new PiAgentService();
		const projectService =
			options.createProjectService?.() ?? new UnityProjectService();
		services.set(socket, { agent: service, projects: projectService });
		const unsubscribe = service.subscribe((event) => send(socket, event));

		socket.on('message', (data, isBinary) => {
			void handleMessage(
				socket,
				service,
				projectService,
				isBinary ? undefined : data.toString(),
			);
		});
		socket.once('close', () => {
			unsubscribe();
			service.dispose();
			projectService.dispose();
			services.delete(socket);
		});
	});

	await new Promise<void>((resolve, reject) => {
		server.once('listening', resolve);
		server.once('error', reject);
	});

	return {
		server,
		close: () =>
			new Promise<void>((resolve, reject) => {
				for (const socket of services.keys())
					socket.close(1001, 'Server closing');
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

async function handleMessage(
	socket: WebSocket,
	service: PiAgentService,
	projectService: UnityProjectService,
	text: string | undefined,
): Promise<void> {
	let input: unknown;
	let request: AgentRequest;
	try {
		if (text === undefined)
			throw new Error('Binary messages are not supported');
		input = JSON.parse(text);
		request = parseAgentRequest(input);
	} catch (error) {
		sendError(
			socket,
			getRequestId(input) ?? 'unknown',
			'invalid_request',
			error,
		);
		return;
	}

	try {
		const result = await dispatch(service, projectService, request);
		send(socket, {
			protocolVersion,
			requestId: request.requestId,
			type: 'response.success',
			...result,
		} satisfies AgentResponse);
	} catch (error) {
		sendError(socket, request.requestId, 'request_failed', error);
	}
}

async function dispatch(
	service: PiAgentService,
	projectService: UnityProjectService,
	request: AgentRequest,
): Promise<{ sessionId?: string; result?: unknown }> {
	switch (request.type) {
		case 'session.list':
			return { result: await service.listSessions() };
		case 'session.create':
			return { sessionId: await service.createSession(request.options) };
		case 'session.resume':
			return {
				sessionId: request.sessionId,
				result: await service.resumeSession(request.sessionId),
			};
		case 'session.rename':
			await service.renameSession(request.sessionId, request.title);
			return {};
		case 'session.prompt':
			await service.prompt(request.sessionId, request.text);
			return {};
		case 'session.steer':
			await service.steer(request.sessionId, request.text);
			return {};
		case 'session.abort':
			await service.abort(request.sessionId);
			return {};
		case 'session.delete':
			await service.deleteSession(request.sessionId);
			return {};
		case 'project.list':
			return { result: await projectService.listProjects() };
		case 'project.status':
			return { result: await projectService.getStatus(request.projectPath) };
		case 'project.open':
			return { result: await projectService.openProject(request.projectPath) };
	}
}

function send(socket: WebSocket, value: unknown): void {
	if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function sendError(
	socket: WebSocket,
	requestId: string,
	code: string,
	error: unknown,
): void {
	send(socket, {
		protocolVersion,
		requestId,
		type: 'response.error',
		code,
		message: error instanceof Error ? error.message : String(error),
	} satisfies AgentResponse);
}

function getRequestId(input: unknown): string | undefined {
	if (!input || typeof input !== 'object' || !('requestId' in input)) return;
	return typeof input.requestId === 'string' && input.requestId
		? input.requestId
		: undefined;
}
