import type { ProjectConfig } from '@gizmo/protocol';
import { extensionUi } from '../../extensions/extension-ui.svelte';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import { errorMessage } from './shared';

export class ExtensionCapability {
	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	/**
	 * Refreshes everything extension-shaped on this client. With `server`
	 * (the default) the server reloads its linked extensions first, so an
	 * edited extension runs new code; registry actions and reload broadcasts
	 * pass `server: false` because the server already did that part.
	 */
	async reloadExtensions(options: { server?: boolean } = {}) {
		const diagnostics: string[] = [];
		if (options.server !== false && this.client.reloadExtensions) {
			const result = await this.client.reloadExtensions();
			diagnostics.push(...result.diagnostics);
			if (result.pendingSessions.length) {
				diagnostics.push(
					`${result.pendingSessions.length} thread(s) are mid-turn and reload when they finish`,
				);
			}
		}
		// The UI is data now: re-fetch the descriptors the server just rebuilt.
		await extensionUi.refresh();
		const store = this.store;
		if (store.connection !== 'connected') return diagnostics;
		await Promise.all([store.refreshResources(), store.refreshProjects()]);
		store.enabledExtensionIds =
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

	/** An extension's stored settings, held by the server for every client. */
	async extensionSettings(extensionId: string) {
		return this.client.getExtensionSettings(extensionId);
	}

	/**
	 * Merges values into them. A `null` clears a key. The server broadcasts
	 * `extension.settings.changed`, so every client (including this one)
	 * re-renders from the event rather than from this answer.
	 */
	async setExtensionSettings(
		extensionId: string,
		values: Record<string, unknown>,
	) {
		return this.client.setExtensionSettings(extensionId, values);
	}

	/** Models a `model` setting can pick from, with no thread in play. */
	async globalModelCatalog() {
		return this.client.getGlobalModelCatalog();
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
			await this.reloadExtensions({ server: false });
		}
		return config;
	}

	async setProjectPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	): Promise<ProjectConfig> {
		const config = await this.client.setProjectPiExtension(
			projectPath,
			extensionId,
			enabled,
		);
		if (projectPath === this.store.selectedProjectPath)
			await this.reloadExtensions();
		return config;
	}

	/**
	 * Replaces the workspace's explicit extension paths. The server already
	 * reloads as part of the change, so only client state refreshes here.
	 */
	async setProjectExtensionPaths(
		projectPath: string,
		paths: string[],
	): Promise<ProjectConfig> {
		const config = await this.client.setProjectExtensionPaths(
			projectPath,
			paths,
		);
		if (projectPath === this.store.selectedProjectPath) {
			await this.reloadExtensions({ server: false });
		}
		return config;
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
