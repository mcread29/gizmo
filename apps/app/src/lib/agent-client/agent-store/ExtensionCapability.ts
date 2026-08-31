import type { ProjectConfig } from '@gizmo/protocol';
import { installWebExtensions } from '../../extensions/runtime/install';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import { errorMessage } from './shared';

export class ExtensionCapability {
	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	async reloadExtensions() {
		const diagnostics = await installWebExtensions(this.client);
		const store = this.store;
		if (store.connection !== 'connected') return diagnostics;
		await Promise.all([store.refreshResources(), store.refreshProjects()]);
		store.activeDomains =
			store.projects
				.find(({ path }) => path === store.selectedProjectPath)
				?.integrations.map(({ id }) => id) ?? [];
		await Promise.all([
			this.loadProjectExtensions(),
			store.refreshProjectStatus(),
			store.refreshGitStatus(),
		]);
		return diagnostics;
	}

	async setProjectGizmoExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	): Promise<ProjectConfig> {
		const config = await this.client.setProjectGizmoExtension(
			projectPath,
			extensionId,
			enabled,
		);
		if (projectPath === this.store.selectedProjectPath) {
			await this.reloadExtensions();
		}
		return config;
	}

	setProjectPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	): Promise<ProjectConfig> {
		return this.client.setProjectPiExtension(projectPath, extensionId, enabled);
	}

	async loadProjectExtensions() {
		const store = this.store;
		if (store.connection !== 'connected' || !store.selectedProjectPath) return;
		const projectPath = store.selectedProjectPath;
		store.extensionsLoading = true;
		try {
			const result = await this.client.listProjectExtensions(projectPath);
			if (store.selectedProjectPath === projectPath) {
				store.projectExtensions = result.extensions;
			}
		} catch (error) {
			if (store.selectedProjectPath === projectPath) {
				store.error = { kind: 'project', message: errorMessage(error) };
			}
		} finally {
			if (store.selectedProjectPath === projectPath) {
				store.extensionsLoading = false;
			}
		}
	}

	async invokeProjectExtension(
		projectPath: string,
		extensionId: string,
		operation: string,
		input?: unknown,
	) {
		if (this.store.selectedProjectPath !== projectPath) {
			throw new Error('The extension project is no longer selected');
		}
		return this.client.invokeProjectExtension(
			projectPath,
			extensionId,
			operation,
			input,
		);
	}
}
