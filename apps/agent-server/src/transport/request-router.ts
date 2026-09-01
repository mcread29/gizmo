import type { ProjectServiceRegistry } from '@gizmo/extensions';
import type { AgentRequest } from '@gizmo/protocol';
import type { ExtensionHostService } from '../extensions/extension-host-service';
import type { PiAgentService } from '../sessions/pi-agent-service';
import {
	handleProjectRequest,
	type ProjectRequestServices,
} from './project-request-handler';
import type { ProjectWatchCoordinator } from './project-watch-coordinator';
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
	watchCoordinator: ProjectWatchCoordinator;
}

export async function routeRequest(
	services: RequestServices,
	request: AgentRequest,
): Promise<RouteResult> {
	switch (request.type) {
		case 'providers.list':
		case 'providers.import-pi-auth':
		case 'attachment.read':
		case 'attachment.reveal':
		case 'session.list':
		case 'session.create':
		case 'session.resume':
		case 'session.rename':
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
		case 'registry.add':
		case 'registry.update':
		case 'registry.remove':
		case 'registry.link':
		case 'registry.unlink':
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
		case 'project.remove':
		case 'project.reorder':
		case 'project.status':
		case 'project.watch':
		case 'project.open':
		case 'project.extensions':
		case 'extensions.web':
		case 'project.extension.invoke':
		case 'git.commit-message':
		case 'file.revert':
			return handleProjectRequest(
				services satisfies ProjectRequestServices,
				request,
			);
	}

	request satisfies never;
	throw new Error('Unsupported request type');
}
