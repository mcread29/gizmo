import {
	parseRegistryStatus,
	parseResourceCatalog,
	parseToolPolicy,
} from '@gizmo/protocol';
import type { InstructionTarget } from '@gizmo/protocol';
import { ProjectRequests } from './project-requests';
import { parseInstructionFile, parseSkillFile } from './response-parsers';

export class ResourceRequests extends ProjectRequests {
	async listResources(workspacePath?: string) {
		const response = await this.request({
			type: 'resources.list',
			...(workspacePath ? { workspacePath } : {}),
		});
		return parseResourceCatalog(response.result);
	}

	async setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	) {
		const response = await this.request({
			type: 'resources.skill.global',
			skillId,
			...(change.installed === undefined
				? {}
				: { installed: change.installed }),
			...(change.enabled === undefined ? {} : { enabled: change.enabled }),
			...(workspacePath ? { workspacePath } : {}),
		});
		return parseResourceCatalog(response.result);
	}

	async readSkill(path: string) {
		const response = await this.request({
			type: 'resources.skill.read',
			path,
		});
		return parseSkillFile(response.result);
	}

	async writeSkill(path: string, content: string) {
		const response = await this.request({
			type: 'resources.skill.write',
			path,
			content,
		});
		return parseSkillFile(response.result);
	}

	async readInstructions(target: InstructionTarget, workspacePath?: string) {
		const response = await this.request({
			type: 'resources.instructions.read',
			target,
			...(workspacePath ? { workspacePath } : {}),
		});
		return parseInstructionFile(response.result);
	}

	async writeInstructions(
		target: InstructionTarget,
		content: string,
		workspacePath?: string,
	) {
		const response = await this.request({
			type: 'resources.instructions.write',
			target,
			content,
			...(workspacePath ? { workspacePath } : {}),
		});
		return parseInstructionFile(response.result);
	}

	async setGlobalExtension(extensionId: string, enabled: boolean) {
		const response = await this.request({
			type: 'resources.extension.global',
			extensionId,
			enabled,
		});
		return parseResourceCatalog(response.result);
	}

	async registryStatus() {
		const response = await this.request({ type: 'registry.status' });
		return parseRegistryStatus(response.result);
	}

	async registryAdd(url: string) {
		const response = await this.request({ type: 'registry.add', url });
		return parseRegistryStatus(response.result);
	}

	async registryUpdate(registry: string) {
		const response = await this.request({
			type: 'registry.update',
			registry,
		});
		return parseRegistryStatus(response.result);
	}

	async registryRemove(registry: string) {
		const response = await this.request({
			type: 'registry.remove',
			registry,
		});
		return parseRegistryStatus(response.result);
	}

	async registryLink(registry: string, id: string) {
		const response = await this.request({
			type: 'registry.link',
			registry,
			id,
		});
		return parseRegistryStatus(response.result);
	}

	async registryUnlink(registry: string, id: string) {
		const response = await this.request({
			type: 'registry.unlink',
			registry,
			id,
		});
		return parseRegistryStatus(response.result);
	}

	async setGlobalGizmoExtension(gizmoExtensionId: string, enabled: boolean) {
		const response = await this.request({
			type: 'resources.gizmo-extension.global',
			gizmoExtensionId,
			enabled,
		});
		return parseResourceCatalog(response.result);
	}

	async getToolPolicy(workspacePath?: string) {
		const response = await this.request({
			type: 'tools.policy.get',
			...(workspacePath ? { workspacePath } : {}),
		});
		return parseToolPolicy(response.result);
	}

	async setGlobalToolPolicy(tools: string[]) {
		const response = await this.request({
			type: 'tools.policy.global.set',
			tools,
		});
		return parseToolPolicy(response.result);
	}

	async setProjectToolPolicy(workspacePath: string, tools: string[] | null) {
		const response = await this.request({
			type: 'tools.policy.project.set',
			workspacePath,
			tools,
		});
		return parseToolPolicy(response.result);
	}

	async setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	) {
		const response = await this.request({
			type: 'resources.skill.project',
			workspacePath,
			skillId,
			enabled,
		});
		return parseResourceCatalog(response.result);
	}
}
