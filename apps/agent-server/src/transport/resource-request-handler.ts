import type { AgentRequest } from '@gizmo/protocol';
import {
	registryAdd,
	registryLink,
	registryRemove,
	registryStatus,
	registryUnlink,
	registryUpdate,
} from '../extensions/registry-manager';
import {
	handleInstructionsRead,
	handleInstructionsWrite,
} from '../resources/instruction-files';
import type { PiAgentService } from '../sessions/pi-agent-service';
import type { RouteResult } from './request-router';

type ResourceRequestType =
	| 'resources.list'
	| 'resources.skill.global'
	| 'resources.skill.read'
	| 'resources.skill.write'
	| 'resources.instructions.read'
	| 'resources.instructions.write'
	| 'resources.extension.global'
	| 'resources.gizmo-extension.global'
	| 'registry.status'
	| 'registry.add'
	| 'registry.update'
	| 'registry.remove'
	| 'registry.link'
	| 'registry.unlink'
	| 'tools.policy.get'
	| 'tools.policy.global.set'
	| 'tools.policy.project.set'
	| 'resources.skill.project';

type ResourceRequest = Extract<AgentRequest, { type: ResourceRequestType }>;

export async function handleResourceRequest(
	service: PiAgentService,
	request: ResourceRequest,
): Promise<RouteResult> {
	switch (request.type) {
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
		case 'resources.skill.read':
			return { result: await service.readSkill(request.path) };
		case 'resources.skill.write':
			return {
				result: await service.writeSkill(request.path, request.content),
			};
		case 'resources.instructions.read':
			return {
				result: await handleInstructionsRead(
					() => service.listProjects(),
					request.target,
					request.workspacePath,
				),
			};
		case 'resources.instructions.write':
			return {
				result: await handleInstructionsWrite(
					() => service.listProjects(),
					request.target,
					request.content,
					request.workspacePath,
				),
			};
		case 'resources.extension.global':
			return {
				result: await service.setGlobalExtension(
					request.extensionId,
					request.enabled,
				),
			};
		case 'resources.gizmo-extension.global':
			return {
				result: await service.setGlobalGizmoExtension(
					request.gizmoExtensionId,
					request.enabled,
				),
			};
		case 'registry.status':
			return { result: await registryStatus() };
		case 'registry.add':
			return { result: await registryAdd(request.url) };
		case 'registry.update':
			return { result: await registryUpdate(request.registry) };
		case 'registry.remove':
			return { result: await registryRemove(request.registry) };
		case 'registry.link':
			return {
				result: await registryLink(request.registry, request.id),
			};
		case 'registry.unlink':
			return {
				result: await registryUnlink(request.registry, request.id),
			};
		case 'tools.policy.get':
			return {
				result: await service.getToolPolicy(request.workspacePath),
			};
		case 'tools.policy.global.set':
			return { result: await service.setGlobalToolPolicy(request.tools) };
		case 'tools.policy.project.set':
			return {
				result: await service.setProjectToolPolicy(
					request.workspacePath,
					request.tools,
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
	}
}
