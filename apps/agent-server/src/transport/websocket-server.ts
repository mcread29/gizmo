import {
	parseAgentRequest,
	protocolVersion,
	type ExtensionDescriptor,
	type AgentRequest,
	type AgentResponse,
} from '@gizmo/protocol';
import type { ProjectService, ProjectStatus } from '@gizmo/extensions';
import { WebSocket, WebSocketServer, type VerifyClientCallbackSync } from 'ws';
import { registeredExtensions } from '../extensions/registry';
import { webExtensionBundles } from '../extensions/web-bundles';
import { PiAgentService } from '../sessions/pi-agent-service';
import { GitService } from '@gizmo/git/server';
import { ExtensionHostService } from '../extensions/extension-host-service';

export interface AgentWebSocketServerOptions {
	host?: string;
	port?: number;
	path?: string;
	allowedOrigins?: readonly string[];
	createService?: () => PiAgentService;
	createProjectService?: () => ProjectService;
	createExtensionHost?: () => ExtensionHostService;
	createGitService?: () => GitService;
}

/** Used when no domain's project service is configured for this connection. */
const noProjectService: ProjectService = {
	getStatus: () =>
		Promise.reject(new Error('No project service is configured')),
	watchStatus: () =>
		Promise.reject(new Error('No project service is configured')),
	openProject: () =>
		Promise.reject(new Error('No project service is configured')),
	revertFile: () =>
		Promise.reject(new Error('No project service is configured')),
	dispose: () => {},
};

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
		maxPayload: 32 * 1024 * 1024,
		verifyClient,
	});
	const services = new Map<
		WebSocket,
		{
			agent: PiAgentService;
			projects: ProjectService;
			extensions: ExtensionHostService;
			git: GitService;
		}
	>();

	server.on('connection', (socket) => {
		let eventId = 0;
		const service = options.createService?.() ?? new PiAgentService();
		const projectService = options.createProjectService?.() ?? noProjectService;
		const extensionHost =
			options.createExtensionHost?.() ?? new ExtensionHostService([]);
		const gitService = options.createGitService?.() ?? new GitService();
		services.set(socket, {
			agent: service,
			projects: projectService,
			extensions: extensionHost,
			git: gitService,
		});
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
			extensions: (sessionId, projectPath, extensions) =>
				send(socket, {
					protocolVersion,
					eventId: ++eventId,
					sessionId,
					type: 'project.extensions.changed',
					projectPath,
					extensions,
				}),
		};

		socket.on('message', (data, isBinary) => {
			void handleMessage(
				socket,
				service,
				projectService,
				extensionHost,
				gitService,
				emit,
				isBinary ? undefined : data.toString(),
			);
		});
		// A socket that errors without a listener would otherwise crash the
		// whole process (Node throws on an unhandled EventEmitter 'error').
		// The 'close' event still fires afterward and tears the session down.
		socket.on('error', (error) => {
			console.error('Agent socket error:', error);
		});
		socket.once('close', () => {
			void (async () => {
				// Give any streaming session a chance to stop cleanly before the
				// dispose loop below tears it down mid-write.
				await service.abortStreamingSessions();
				unsubscribe();
				// Each dispose is independent; one throwing must not skip the rest,
				// since that would leak whichever resource came after it.
				for (const disposeOne of [
					() => service.dispose(),
					() => projectService.dispose(),
					() => extensionHost.dispose(),
				]) {
					try {
						disposeOne();
					} catch (error) {
						console.error('Error disposing agent session resource:', error);
					}
				}
				services.delete(socket);
			})();
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
	status(sessionId: string, projectPath: string, status: ProjectStatus): void;
	extensions(
		sessionId: string,
		projectPath: string,
		extensions: ExtensionDescriptor[],
	): void;
}

async function handleMessage(
	socket: WebSocket,
	service: PiAgentService,
	projectService: ProjectService,
	extensionHost: ExtensionHostService,
	gitService: GitService,
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
		const result = await dispatch(
			service,
			projectService,
			extensionHost,
			gitService,
			emit,
			request,
		);
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
	projectService: ProjectService,
	extensionHost: ExtensionHostService,
	gitService: GitService,
	emit: ProjectEmitters,
	request: AgentRequest,
): Promise<{ sessionId?: string; result?: unknown }> {
	switch (request.type) {
		case 'providers.list':
			return { result: await service.listProviders() };
		case 'providers.import-pi-auth':
			return { result: await service.reimportPiAuth() };
		case 'attachment.read':
			return {
				result: await service.readAttachment(
					request.sessionId,
					request.attachmentId,
				),
			};
		case 'attachment.reveal':
			await service.revealAttachment(request.sessionId, request.attachmentId);
			return {};
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
			await service.prompt(
				request.sessionId,
				request.text,
				request.compaction,
				request.attachments,
			);
			return {};
		case 'session.compact':
			await service.compact(request.sessionId, request.compaction);
			return {};
		case 'session.steer':
			await service.steer(request.sessionId, request.text, request.attachments);
			return {};
		case 'session.abort':
			await service.abort(request.sessionId);
			return {};
		case 'confirmation.resolve':
			service.resolveConfirmation(
				request.sessionId,
				request.confirmationId,
				request.accepted,
			);
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
			return { result: await service.listProjects() };
		case 'project.detect':
			return { result: await service.detectProject(request.projectPath) };
		case 'project.browse':
			return { result: await service.browseProjects(request.path) };
		case 'project.search':
			return {
				result: await service.searchProjects(request.query, request.root),
			};
		case 'project.add':
			return {
				result: await service.addProject(
					request.projectPath,
					request.integrations,
				),
			};
		case 'project.profiles.save':
			return {
				result: await service.saveProjectProfiles(
					request.projectPath,
					request.profiles,
				),
			};
		case 'project.remove':
			await service.removeProject(request.projectPath);
			return {};
		case 'resources.list':
			return { result: await service.listResources(request.workspacePath) };
		case 'resources.skill.global':
			return {
				result: await service.setGlobalSkill(
					request.skillId,
					{
						...(request.installed === undefined
							? {}
							: { installed: request.installed }),
						...(request.enabled === undefined
							? {}
							: { enabled: request.enabled }),
					},
					request.workspacePath,
				),
			};
		case 'resources.skill.project':
			return {
				result: await service.setProjectSkill(
					request.workspacePath,
					request.skillId,
					request.enabled,
				),
			};
		case 'project.status':
			return { result: await projectService.getStatus(request.projectPath) };
		case 'project.watch':
			extensionHost.watch(request.projectPath, (extensions) =>
				emit.extensions(request.sessionId, request.projectPath, extensions),
			);
			return {
				result: await projectService.watchStatus(request.projectPath, {
					status: (status) =>
						emit.status(request.sessionId, request.projectPath, status),
				}),
			};
		case 'project.open':
			return { result: await projectService.openProject(request.projectPath) };
		case 'project.extensions':
			return {
				result: {
					extensions: await extensionHost.list(request.projectPath),
				},
			};
		case 'extensions.web':
			return { result: await webExtensionBundles(registeredExtensions()) };
		case 'project.extension.invoke':
			return {
				result: await extensionHost.invoke(
					request.projectPath,
					request.extensionId,
					request.operation,
					request.input,
				),
			};
		case 'git.commit-message': {
			const context = await gitService.commitContext(request.projectPath);
			return {
				result: await service.generateCommitMessage(request.sessionId, context),
			};
		}
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
