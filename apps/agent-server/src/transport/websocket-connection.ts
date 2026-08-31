import type { ProjectService, ProjectStatus } from '@gizmo/extensions';
import { protocolVersion, type ExtensionDescriptor } from '@gizmo/protocol';
import { WebSocket } from 'ws';
import { ExtensionHostService } from '../extensions/extension-host-service';
import { PiAgentService } from '../sessions/pi-agent-service';
import { sendMessage } from './protocol-messages';
import {
	createProjectWatchCoordinator,
	type ProjectEmitters,
} from './project-watch-coordinator';
import { handleRequestMessage } from './request-message-handler';

export interface AgentConnectionFactories {
	createService?: () => PiAgentService;
	createProjectService?: () => ProjectService;
	createExtensionHost?: () => ExtensionHostService;
}

/** Attach one isolated set of domain services and one event sequence to a socket. */
export function attachAgentConnection(
	socket: WebSocket,
	factories: AgentConnectionFactories,
): void {
	const agent = factories.createService?.() ?? new PiAgentService();
	const projects = factories.createProjectService?.() ?? noProjectService;
	const extensions =
		factories.createExtensionHost?.() ?? new ExtensionHostService([]);
	let eventId = 0;

	const emit: ProjectEmitters = {
		status: (sessionId, projectPath, status) =>
			sendProjectStatus(socket, ++eventId, sessionId, projectPath, status),
		extensions: (sessionId, projectPath, descriptors) =>
			sendProjectExtensions(
				socket,
				++eventId,
				sessionId,
				projectPath,
				descriptors,
			),
	};
	const watchCoordinator = createProjectWatchCoordinator(
		projects,
		extensions,
		emit,
	);
	const services = { agent, projects, extensions, watchCoordinator };
	const unsubscribe = agent.subscribe((event) =>
		sendMessage(socket, { ...event, eventId: ++eventId }),
	);

	socket.on('message', (data, isBinary) => {
		void handleRequestMessage(
			socket,
			services,
			isBinary ? undefined : data.toString(),
		);
	});
	// An unhandled EventEmitter error would otherwise crash the process. The
	// close event still follows and owns resource cleanup.
	socket.on('error', (error) => {
		console.error('Agent socket error:', error);
	});
	socket.once('close', () => {
		void disposeConnection(agent, projects, extensions, unsubscribe);
	});
}

async function disposeConnection(
	agent: PiAgentService,
	projects: ProjectService,
	extensions: ExtensionHostService,
	unsubscribe: () => void,
): Promise<void> {
	// Let active streams stop before disposing resources they may still use.
	await agent.abortStreamingSessions();
	unsubscribe();

	// A failure in one resource must not leak resources disposed after it.
	for (const disposeOne of [
		() => agent.dispose(),
		() => projects.dispose(),
		() => extensions.dispose(),
	]) {
		try {
			disposeOne();
		} catch (error) {
			console.error('Error disposing agent session resource:', error);
		}
	}
}

function sendProjectStatus(
	socket: WebSocket,
	eventId: number,
	sessionId: string,
	projectPath: string,
	status: ProjectStatus,
): void {
	sendMessage(socket, {
		protocolVersion,
		eventId,
		sessionId,
		type: 'project.status.changed',
		projectPath,
		status: { ...status, command: [...status.command] },
	});
}

function sendProjectExtensions(
	socket: WebSocket,
	eventId: number,
	sessionId: string,
	projectPath: string,
	extensions: ExtensionDescriptor[],
): void {
	sendMessage(socket, {
		protocolVersion,
		eventId,
		sessionId,
		type: 'project.extensions.changed',
		projectPath,
		extensions,
	});
}

/** Used when no domain project service is configured for a connection. */
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
