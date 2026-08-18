import {
	parseAgentRequest,
	protocolVersion,
	type AgentRequest,
	type AgentResponse,
} from '@unity-agent/protocol';
import type {
	UnityConsoleDetails,
	UnityStatusDetails,
} from '@unity-agent/unity-tools';
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
		let eventId = 0;
		const service = options.createService?.() ?? new PiAgentService();
		const projectService =
			options.createProjectService?.() ?? new UnityProjectService();
		services.set(socket, { agent: service, projects: projectService });
		const unsubscribe = service.subscribe((event) =>
			send(socket, { ...event, eventId: ++eventId }),
		);
		const emit: ProjectEmitters = {
			status: (sessionId, projectPath, status) =>
				send(socket, {
					protocolVersion,
					eventId: ++eventId,
					sessionId,
					type: 'project.status.changed',
					projectPath,
					status: { ...status, command: [...status.command] },
				}),
			console: (sessionId, projectPath, update) =>
				send(socket, {
					protocolVersion,
					eventId: ++eventId,
					sessionId,
					type: 'project.console.appended',
					projectPath,
					update: {
						entries: update.entries.map((entry) => ({ ...entry })),
						...(update.cursor === undefined ? {} : { cursor: update.cursor }),
						dropped: update.dropped,
					},
				}),
		};

		socket.on('message', (data, isBinary) => {
			void handleMessage(
				socket,
				service,
				projectService,
				emit,
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

interface ProjectEmitters {
	status(
		sessionId: string,
		projectPath: string,
		status: UnityStatusDetails,
	): void;
	console(
		sessionId: string,
		projectPath: string,
		update: UnityConsoleDetails,
	): void;
}

function consoleUpdate(details: UnityConsoleDetails) {
	return {
		entries: details.entries.map((entry) => ({ ...entry })),
		...(details.cursor === undefined ? {} : { cursor: details.cursor }),
		dropped: details.dropped,
	};
}

async function handleMessage(
	socket: WebSocket,
	service: PiAgentService,
	projectService: UnityProjectService,
	emit: ProjectEmitters,
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
		const result = await dispatch(service, projectService, emit, request);
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
	emit: ProjectEmitters,
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
			await service.prompt(request.sessionId, request.text, request.compaction);
			return {};
		case 'session.compact':
			await service.compact(request.sessionId, request.compaction);
			return {};
		case 'session.steer':
			await service.steer(request.sessionId, request.text);
			return {};
		case 'session.abort':
			await service.abort(request.sessionId);
			return {};
		case 'session.tree':
			return { result: await service.getTree(request.sessionId) };
		case 'session.branch':
			return {
				sessionId: request.sessionId,
				result: await service.branchSession(request.sessionId, request.entryId),
			};
		case 'session.label':
			return {
				result: await service.labelEntry(
					request.sessionId,
					request.entryId,
					request.label,
				),
			};
		case 'session.delete':
			await service.deleteSession(request.sessionId);
			return {};
		case 'model.catalog':
			return { result: await service.getModelCatalog(request.sessionId) };
		case 'model.select':
			return {
				result: await service.selectModel(
					request.sessionId,
					request.provider,
					request.modelId,
				),
			};
		case 'thinking.select':
			return {
				result: await service.selectThinkingLevel(
					request.sessionId,
					request.level,
				),
			};
		case 'project.list':
			return { result: await projectService.listProjects() };
		case 'project.status':
			return { result: await projectService.getStatus(request.projectPath) };
		case 'project.watch':
			return {
				result: await projectService.watchStatus(request.projectPath, {
					status: (status) =>
						emit.status(request.sessionId, request.projectPath, status),
					console: (update) =>
						emit.console(request.sessionId, request.projectPath, update),
				}),
			};
		case 'project.open':
			return { result: await projectService.openProject(request.projectPath) };
		case 'project.console':
			return {
				result: consoleUpdate(
					await projectService.readConsole(request.projectPath, request.tail),
				),
			};
		case 'file.revert':
			await projectService.revertFile(
				request.projectPath,
				request.file,
				request.patch,
			);
			return { result: { file: request.file, reverted: true } };
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
