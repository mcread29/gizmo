import type { ProjectService, ProjectServiceRegistry } from '@gizmo/extensions';
import type { AgentRequest } from '@gizmo/protocol';
import type { ExtensionHostService } from '../extensions/extension-host-service';
import { registeredExtensions } from '../extensions/registry';
import { extensionWebDir } from '../extensions/registry-manager';
import {
	piExtensionWebBundles,
	webExtensionBundles,
} from '../extensions/web-bundles';
import type { PiAgentService } from '../sessions/pi-agent-service';
import type { ProjectWatchCoordinator } from './project-watch-coordinator';
import type { RouteResult } from './request-router';

type ProjectRequestType =
	| 'project.list'
	| 'project.detect'
	| 'project.browse'
	| 'project.search'
	| 'project.add'
	| 'project.gizmo-extension.set'
	| 'project.pi-extension.set'
	| 'project.remove'
	| 'project.reorder'
	| 'project.status'
	| 'project.watch'
	| 'project.open'
	| 'project.extensions'
	| 'extensions.web'
	| 'project.extension.invoke'
	| 'git.commit-message'
	| 'file.revert';

type ProjectRequest = Extract<AgentRequest, { type: ProjectRequestType }>;

export interface ProjectRequestServices {
	agent: PiAgentService;
	projectServices: ProjectServiceRegistry;
	extensions: ExtensionHostService;
	watchCoordinator: ProjectWatchCoordinator;
}

export async function handleProjectRequest(
	services: ProjectRequestServices,
	request: ProjectRequest,
): Promise<RouteResult> {
	const { agent, projectServices, extensions, watchCoordinator } = services;

	switch (request.type) {
		case 'project.list':
			return { result: await agent.listProjects() };
		case 'project.detect':
			return { result: await agent.detectProject(request.projectPath) };
		case 'project.browse':
			return { result: await agent.browseProjects(request.path) };
		case 'project.search':
			return {
				result: await agent.searchProjects(request.query, request.root),
			};
		case 'project.add':
			return { result: await agent.addProject(request.projectPath) };
		case 'project.gizmo-extension.set':
			return {
				result: await agent.setProjectGizmoExtension(
					request.projectPath,
					request.extensionId,
					request.enabled,
				),
			};
		case 'project.pi-extension.set':
			return {
				result: await agent.setProjectPiExtension(
					request.projectPath,
					request.extensionId,
					request.enabled,
				),
			};
		case 'project.remove':
			await agent.removeProject(request.projectPath);
			return {};
		case 'project.reorder':
			return { result: await agent.reorderProjects(request.paths) };
		case 'project.status':
			if ('extensionId' in request) {
				return {
					result: await projectServices
						.requireService(request.extensionId)
						.getStatus(request.projectPath),
				};
			}
			// v25 compatibility: the request names no extension.
			return {
				result: await v25FirstService(projectServices, (service) =>
					service.getStatus(request.projectPath),
				),
			};
		case 'project.watch':
			if ('extensionId' in request) {
				return {
					result: await watchCoordinator.watch(
						request.sessionId,
						request.projectPath,
						request.extensionId,
					),
				};
			}
			// v25 compatibility: watch the first service that answers.
			return {
				result: await v25FirstService(projectServices, (service, id) =>
					watchCoordinator.watch(request.sessionId, request.projectPath, id),
				),
			};
		case 'project.open':
			if ('extensionId' in request) {
				return {
					result: await projectServices
						.requireService(request.extensionId)
						.openProject(request.projectPath),
				};
			}
			// v25 compatibility: the request names no extension.
			return {
				result: await v25FirstService(projectServices, (service) =>
					service.openProject(request.projectPath),
				),
			};
		case 'project.extensions':
			return {
				result: {
					extensions: await extensions.list(request.projectPath),
				},
			};
		case 'extensions.web': {
			// Browser companions are kept outside Pi's backend extension directory.
			const pi = await piExtensionWebBundles([extensionWebDir()]);
			const gizmo = await webExtensionBundles(registeredExtensions());
			return {
				result: {
					bundles: [...gizmo.bundles, ...pi.bundles],
					diagnostics: [...gizmo.diagnostics, ...pi.diagnostics],
				},
			};
		}
		case 'project.extension.invoke':
			return {
				result: await extensions.invoke(
					request.projectPath,
					request.extensionId,
					request.operation,
					request.input,
				),
			};
		case 'git.commit-message': {
			const context = await extensions.invoke(
				request.projectPath,
				'git',
				'commit-context',
				undefined,
			);
			if (typeof context !== 'string') {
				throw new Error('The Git extension returned invalid commit context');
			}
			return {
				result: await agent.generateCommitMessage(request.sessionId, context),
			};
		}
		case 'file.revert':
			// v25 compatibility: reverting an agent-recorded edit has no
			// extension identity on the wire yet, so the edit is undone by the
			// first registered project service that handles it. A future
			// protocol version must give edits an owning extension id.
			await v25FirstService(projectServices, (service) =>
				service.revertFile(request.projectPath, request.file, request.patch),
			);
			return { result: { file: request.file, reverted: true } };
	}
}

/**
 * v25 compatibility routing: v25 project requests could not name an
 * extension, so each operation is offered to every registered project
 * service in registration order and the first success wins — the exact
 * behavior of the removed `CompositeProjectService`. Only v25-shaped
 * requests (`project.status`/`project.open`/`project.watch` without an
 * extensionId, and `file.revert`) reach this path; remove it when v25
 * project requests are no longer accepted.
 */
async function v25FirstService<T>(
	projectServices: ProjectServiceRegistry,
	call: (service: ProjectService, extensionId: string) => Promise<T>,
): Promise<T> {
	let lastError: unknown;
	for (const [extensionId, service] of projectServices.entries) {
		try {
			return await call(service, extensionId);
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error('No project service is configured');
}
