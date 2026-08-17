import {
	parseAgentRequest,
	protocolVersion,
	type AgentRequest,
	type AgentResponse,
} from '@unity-agent/protocol';
import { WebSocket, WebSocketServer, type VerifyClientCallbackSync } from 'ws';
import { PiAgentService } from './pi-agent-service';

export interface AgentWebSocketServerOptions {
	host?: string;
	port?: number;
	path?: string;
	allowedOrigins?: readonly string[];
	createService?: () => PiAgentService;
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
	const services = new Map<WebSocket, PiAgentService>();

	server.on('connection', (socket) => {
		const service = options.createService?.() ?? new PiAgentService();
		services.set(socket, service);
		const unsubscribe = service.subscribe((event) => send(socket, event));

		socket.on('message', (data, isBinary) => {
			void handleMessage(
				socket,
				service,
				isBinary ? undefined : data.toString(),
			);
		});
		socket.once('close', () => {
			unsubscribe();
			service.dispose();
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
];

async function handleMessage(
	socket: WebSocket,
	service: PiAgentService,
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
		const sessionId = await dispatch(service, request);
		send(socket, {
			protocolVersion,
			requestId: request.requestId,
			type: 'response.success',
			...(sessionId ? { sessionId } : {}),
		} satisfies AgentResponse);
	} catch (error) {
		sendError(socket, request.requestId, 'request_failed', error);
	}
}

async function dispatch(
	service: PiAgentService,
	request: AgentRequest,
): Promise<string | undefined> {
	switch (request.type) {
		case 'session.create':
			return service.createSession(request.options);
		case 'session.prompt':
			await service.prompt(request.sessionId, request.text);
			return;
		case 'session.steer':
			await service.steer(request.sessionId, request.text);
			return;
		case 'session.abort':
			await service.abort(request.sessionId);
			return;
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
