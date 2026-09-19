import {
	readManagedSkill,
	setPiExtensionEnabled,
	writeManagedSkill,
} from '../resources/pi-global-resources';
import {
	listProviders,
	reimportPiAuth,
	removeProviderApiKey,
	setProviderApiKey,
} from './pi-model-runtime';
import { PiAgentServiceCore } from './pi-agent-service-core';
import { reloadExtensions } from '../extensions/extension-reload';

/** Resource, skill, extension, and tool-policy commands. */
export class PiAgentServiceResources extends PiAgentServiceCore {
	listProviders() {
		return listProviders();
	}

	reimportPiAuth() {
		return reimportPiAuth();
	}

	setProviderApiKey(providerId: string, apiKey: string) {
		return setProviderApiKey(providerId, apiKey);
	}

	removeProviderApiKey(providerId: string) {
		return removeProviderApiKey(providerId);
	}

	listResources(workspacePath?: string) {
		return this.context.resources.list(workspacePath);
	}

	setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	) {
		return this.context.resources.setGlobalSkill(
			skillId,
			change,
			workspacePath,
		);
	}

	setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	) {
		return this.context.resources.setProjectSkill(
			workspacePath,
			skillId,
			enabled,
		);
	}

	async readSkill(path: string) {
		const catalog = await this.context.resources.list();
		return readManagedSkill(
			path,
			catalog.skills.map((skill) => skill.path),
		);
	}

	async writeSkill(path: string, content: string) {
		const catalog = await this.context.resources.list();
		return writeManagedSkill(
			path,
			content,
			catalog.skills
				.filter((skill) => skill.editable)
				.map((skill) => skill.path),
		);
	}

	async setGlobalExtension(extensionId: string, enabled: boolean) {
		await setPiExtensionEnabled(extensionId, enabled);
		await reloadExtensions();
		return this.context.resources.list();
	}

	async setGlobalGizmoExtension(extensionId: string, enabled: boolean) {
		await this.context.resources.setGlobalGizmoExtension(extensionId, enabled);
		await reloadExtensions();
		return this.context.resources.list();
	}

	getToolPolicy(workspacePath?: string) {
		return this.context.toolPolicy.get(workspacePath);
	}

	setGlobalToolPolicy(tools: string[]) {
		return this.context.toolPolicy.setGlobal(tools);
	}

	setProjectToolPolicy(workspacePath: string, tools: string[] | null) {
		return this.context.toolPolicy.setProject(workspacePath, tools);
	}
}
