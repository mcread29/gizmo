import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import { errorMessage } from './shared';

export class ResourceCapability {
	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	async refreshResources(workspacePath?: string) {
		const store = this.store;
		if (store.connection !== 'connected') return;
		store.resourcesLoading = true;
		store.resourceError = undefined;
		try {
			store.resources = await this.client.listResources(workspacePath);
		} catch (error) {
			store.resourceError = errorMessage(error);
		} finally {
			store.resourcesLoading = false;
		}
	}

	async setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	) {
		this.store.resourceError = undefined;
		try {
			this.store.resources = await this.client.setGlobalSkill(
				skillId,
				change,
				workspacePath,
			);
		} catch (error) {
			this.store.resourceError = errorMessage(error);
		}
	}

	readSkill(path: string) {
		return this.client.readSkill(path);
	}

	async writeSkill(path: string, content: string) {
		this.store.resourceError = undefined;
		try {
			await this.client.writeSkill(path, content);
			await this.refreshResources();
			return true;
		} catch (error) {
			this.store.resourceError = errorMessage(error);
			return false;
		}
	}

	async setGlobalExtension(extensionId: string, enabled: boolean) {
		this.store.resourceError = undefined;
		try {
			this.store.resources = await this.client.setGlobalExtension(
				extensionId,
				enabled,
			);
		} catch (error) {
			this.store.resourceError = errorMessage(error);
		}
	}

	async setGlobalGizmoExtension(gizmoExtensionId: string, enabled: boolean) {
		this.store.resourceError = undefined;
		try {
			this.store.resources = await this.client.setGlobalGizmoExtension(
				gizmoExtensionId,
				enabled,
			);
			await this.store.reloadExtensions();
		} catch (error) {
			this.store.resourceError = errorMessage(error);
		}
	}

	async setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	) {
		this.store.resourceError = undefined;
		try {
			this.store.resources = await this.client.setProjectSkill(
				workspacePath,
				skillId,
				enabled,
			);
		} catch (error) {
			this.store.resourceError = errorMessage(error);
		}
	}

	async refreshToolPolicy(workspacePath?: string) {
		const store = this.store;
		if (store.connection !== 'connected') return;
		store.toolPolicyLoading = true;
		store.toolPolicyError = undefined;
		try {
			store.toolPolicy = await this.client.getToolPolicy(workspacePath);
		} catch (error) {
			store.toolPolicyError = errorMessage(error);
		} finally {
			store.toolPolicyLoading = false;
		}
	}

	async setGlobalToolPolicy(tools: string[]) {
		this.store.toolPolicyError = undefined;
		try {
			this.store.toolPolicy = await this.client.setGlobalToolPolicy(tools);
			return true;
		} catch (error) {
			this.store.toolPolicyError = errorMessage(error);
			return false;
		}
	}

	async setProjectToolPolicy(workspacePath: string, tools: string[] | null) {
		this.store.toolPolicyError = undefined;
		try {
			this.store.toolPolicy = await this.client.setProjectToolPolicy(
				workspacePath,
				tools,
			);
			return true;
		} catch (error) {
			this.store.toolPolicyError = errorMessage(error);
			return false;
		}
	}
}
