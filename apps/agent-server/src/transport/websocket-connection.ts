import { ProjectServiceRegistry } from '@gizmo/extensions';
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
	createProjectServices?: () => ProjectServiceRegistry;
	createExtensionHost?: () => ExtensionHostService;
}

/** Attach one isolated set of domain services and one event sequence to a socket. */
export function attachAgentConnection(
	socket: WebSocket,
	factories: AgentConnectionFactories,
): void {
	const agent = factories.createService?.() ?? new PiAgentService();
	const projectServices =
		factories.createProjectServices?.() ?? noProjectServices;
	const extensions =
		factories.createExtensionHost?.() ?? new ExtensionHostService([]);
	let eventId = 0;

	const emit: ProjectEmitters = {
		status: (sessionId, projectPath, extensionId, status) =>
			sendProjectStatus(
				socket,
				++eventId,
				sessionId,
				projectPath,
				extensionId,
				status,
			),
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
		projectServices,
		extensions,
		emit,
	);
	const services = {
		agent,
		projectServices,
		extensions,
		watchCoordinator,
	};
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
		void disposeConnection(agent, projectServices, extensions, unsubscribe);
	});
}

async function disposeConnection(
	agent: PiAgentService,
	projectServices: ProjectServiceRegistry,
	extensions: ExtensionHostService,
	unsubscribe: () => void,
): Promise<void> {
	// Let active streams stop before disposing resources they may still use.
	await agent.abortStreamingSessions();
	unsubscribe();

	// A failure in one resource must not leak resources disposed after it.
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
}

function sendProjectStatus(
	socket: WebSocket,
	eventId: number,
	sessionId: string,
	projectPath: string,
	extensionId: string,
	status: unknown,
): void {
	sendMessage(socket, {
		protocolVersion,
		eventId,
		sessionId,
		type: 'project.status.changed',
		projectPath,
		extensionId,
		status,
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

/** Used when no domain project services are configured for a connection. */
const noProjectServices = new ProjectServiceRegistry([]);
