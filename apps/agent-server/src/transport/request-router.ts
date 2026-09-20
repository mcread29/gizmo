import type { ProjectServiceRegistry } from '@gizmo/extension-api';
import type { AgentRequest } from '@gizmo/protocol';
import type { ExtensionHostService } from '../extensions/extension-host-service';
import type { ExtensionUiService } from '../extensions/extension-ui-service';
import { handleExtensionUiRequest } from './extension-ui-request-handler';
import { MemoryService } from '../memory/memory-service';
import type { PiAgentService } from '../sessions/pi-agent-service';
import {
	handleProjectRequest,
	type ProjectRequestServices,
} from './project-request-handler';
import type { ProjectWatchCoordinator } from './project-watch-coordinator';
import { handleMemoryRequest } from './memory-request-handler';
import { handleResourceRequest } from './resource-request-handler';
import { handleSessionRequest } from './session-request-handler';

export interface RouteResult {
	sessionId?: string;
	result?: unknown;
}

export interface RequestServices {
	agent: PiAgentService;
	projectServices: ProjectServiceRegistry;
	extensions: ExtensionHostService;
	ui: ExtensionUiService;
	watchCoordinator: ProjectWatchCoordinator;
}

/**
 * The memory layer holds the state of in-flight backfills, so one instance is
 * shared across every connection rather than built per request.
 */
const memory = new MemoryService();

export async function routeRequest(
	services: RequestServices,
	request: AgentRequest,
	/** The connection making the request; views are owned by it. */
	owner: object = services,
): Promise<RouteResult> {
	switch (request.type) {
		case 'extensions.ui':
		case 'extension.view.open':
		case 'extension.view.close':
		case 'extension.view.action':
		case 'extension.command.run':
			return handleExtensionUiRequest(services.ui, owner, request);

		case 'providers.list':
		case 'providers.import-pi-auth':
		case 'providers.set-api-key':
		case 'providers.remove-api-key':
		case 'providers.read-api-key':
		case 'attachment.read':
		case 'attachment.reveal':
		case 'session.list':
		case 'session.create':
		case 'session.resume':
		case 'session.read':
		case 'session.rename':
		case 'session.title':
		case 'session.prompt':
		case 'session.commands':
		case 'session.compact':
		case 'session.reload':
		case 'session.steer':
		case 'session.abort':
		case 'extension.ui.respond':
		case 'confirmation.resolve':
		case 'session.tree':
		case 'session.branch':
		case 'session.label':
		case 'session.delete':
		case 'model.catalog':
		case 'model.select':
		case 'thinking.select':
			return handleSessionRequest(services.agent, request);

		case 'resources.list':
		case 'resources.skill.global':
		case 'resources.skill.read':
		case 'resources.skill.write':
		case 'resources.instructions.read':
		case 'resources.instructions.write':
		case 'resources.extension.global':
		case 'resources.gizmo-extension.global':
		case 'registry.status':
		case 'registry.update':
		case 'registry.link':
		case 'registry.unlink':
		case 'registry.reset':
		case 'extensions.reload':
		case 'tools.policy.get':
		case 'tools.policy.global.set':
		case 'tools.policy.project.set':
		case 'resources.skill.project':
			return handleResourceRequest(services.agent, request);

		case 'project.list':
		case 'project.detect':
		case 'project.browse':
		case 'project.search':
		case 'project.add':
		case 'project.gizmo-extension.set':
		case 'project.pi-extension.set':
		case 'project.extension-paths.set':
		case 'project.remove':
		case 'project.reorder':
		case 'project.status':
		case 'project.watch':
		case 'project.open':
		case 'project.extensions':
		case 'project.extension.invoke':
		case 'git.commit-message':
		case 'file.revert':
			return handleProjectRequest(
				services satisfies ProjectRequestServices,
				request,
			);

		case 'memory.status':
		case 'memory.digests':
		case 'memory.facts':
		case 'memory.settings':
		case 'memory.settings.set':
		case 'memory.backfill.start':
		case 'memory.backfill.stop':
			return handleMemoryRequest(memory, request);
	}

	request satisfies never;
	throw new Error('Unsupported request type');
}
