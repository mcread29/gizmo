import type { ProjectService } from '@gizmo/extensions';
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
	projects: ProjectService;
	extensions: ExtensionHostService;
	watchCoordinator: ProjectWatchCoordinator;
}

export async function handleProjectRequest(
	services: ProjectRequestServices,
	request: ProjectRequest,
): Promise<RouteResult> {
	const { agent, projects, extensions, watchCoordinator } = services;

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
		case 'project.status':
			return { result: await projects.getStatus(request.projectPath) };
		case 'project.watch':
			return {
				result: await watchCoordinator.watch(
					request.sessionId,
					request.projectPath,
				),
			};
		case 'project.open':
			return { result: await projects.openProject(request.projectPath) };
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
			await projects.revertFile(
				request.projectPath,
				request.file,
				request.patch,
			);
			return { result: { file: request.file, reverted: true } };
	}
}
