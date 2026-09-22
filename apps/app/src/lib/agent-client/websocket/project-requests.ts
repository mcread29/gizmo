import type { CompactionPolicy } from '@gizmo/protocol';
import {
	parseCompactionPolicy,
	parseExtensions,
	parseProjectConfig,
	parseProjectDomains,
	parseActionResult,
	parseExtensionSettingsValues,
	parseExtensionsUi,
	parseGlobalModelCatalog,
	parseStoredProjects,
	parseViewResult,
	parseWorkspaceDirectoryListing,
} from '@gizmo/protocol';
import type { ActionEvent } from '@gizmo/extension-api';
import type { ExtensionViewAddress } from '../AgentClient';
import { SessionRequests } from './session-requests';

export class ProjectRequests extends SessionRequests {
	async listProjects() {
		const response = await this.request({ type: 'project.list' });
		return parseStoredProjects(response.result);
	}

	async detectProject(projectPath: string) {
		const response = await this.request({
			type: 'project.detect',
			projectPath,
		});
		return parseProjectDomains(response.result);
	}

	async browseProjects(path?: string) {
		const response = await this.request({
			type: 'project.browse',
			...(path ? { path } : {}),
		});
		return parseWorkspaceDirectoryListing(response.result);
	}

	async searchProjects(query: string, root?: string) {
		const response = await this.request({
			type: 'project.search',
			query,
			...(root ? { root } : {}),
		});
		return parseWorkspaceDirectoryListing(response.result);
	}

	async addProject(projectPath: string) {
		const response = await this.request({ type: 'project.add', projectPath });
		const [project] = parseStoredProjects([response.result]);
		if (!project) {
			throw new Error('Agent server did not return the added project');
		}
		return project;
	}

	async setProjectGizmoExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		const response = await this.request({
			type: 'project.gizmo-extension.set',
			projectPath,
			extensionId,
			enabled,
		});
		return parseProjectConfig(response.result);
	}

	async setProjectPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		const response = await this.request({
			type: 'project.pi-extension.set',
			projectPath,
			extensionId,
			enabled,
		});
		return parseProjectConfig(response.result);
	}

	async setProjectExtensionPaths(projectPath: string, paths: string[]) {
		const response = await this.request({
			type: 'project.extension-paths.set',
			projectPath,
			paths,
		});
		return parseProjectConfig(response.result);
	}

	async removeProject(projectPath: string) {
		await this.request({ type: 'project.remove', projectPath });
	}

	async getProjectCompaction(projectPath: string) {
		const response = await this.request({
			type: 'project.compaction.get',
			projectPath,
		});
		return parseCompactionPolicy(response.result);
	}

	async setProjectCompaction(
		projectPath: string,
		compaction: CompactionPolicy,
	) {
		const response = await this.request({
			type: 'project.compaction.set',
			projectPath,
			compaction,
		});
		return parseCompactionPolicy(response.result);
	}

	async setProjectHidden(projectPath: string, hidden: boolean) {
		const response = await this.request({
			type: 'project.hidden.set',
			projectPath,
			hidden,
		});
		const [project] = parseStoredProjects([response.result]);
		if (!project) {
			throw new Error('Agent server did not return the updated workspace');
		}
		return project;
	}

	async reorderProjects(paths: string[]) {
		const response = await this.request({ type: 'project.reorder', paths });
		return parseStoredProjects(response.result);
	}

	async getProjectStatus(projectPath: string, extensionId: string) {
		const response = await this.request({
			type: 'project.status',
			projectPath,
			extensionId,
		});
		// Opaque extension-owned payload; the owning extension validates it.
		return response.result;
	}

	async watchProjectStatus(
		sessionId: string,
		projectPath: string,
		extensionId: string,
	) {
		const response = await this.request({
			type: 'project.watch',
			sessionId,
			projectPath,
			extensionId,
		});
		return response.result;
	}

	async openProject(projectPath: string, extensionId: string) {
		const response = await this.request({
			type: 'project.open',
			projectPath,
			extensionId,
		});
		return response.result;
	}

	async listProjectExtensions(projectPath: string) {
		const response = await this.request({
			type: 'project.extensions',
			projectPath,
		});
		return parseExtensions(response.result);
	}

	async listExtensionUi(projectPath: string, sessionId?: string) {
		const response = await this.request({
			type: 'extensions.ui',
			projectPath,
			...(sessionId ? { sessionId } : {}),
		});
		return parseExtensionsUi(response.result).extensions;
	}

	async getExtensionSettings(extensionId: string) {
		const response = await this.request({
			type: 'extension.settings.get',
			extensionId,
		});
		return parseExtensionSettingsValues(response.result).values;
	}

	async setExtensionSettings(
		extensionId: string,
		values: Record<string, unknown>,
	) {
		const response = await this.request({
			type: 'extension.settings.set',
			extensionId,
			values,
		});
		return parseExtensionSettingsValues(response.result).values;
	}

	async getGlobalModelCatalog() {
		const response = await this.request({ type: 'models.catalog' });
		return parseGlobalModelCatalog(response.result);
	}

	async openExtensionView(address: ExtensionViewAddress) {
		const response = await this.request({
			type: 'extension.view.open',
			...addressFields(address),
		});
		return parseViewResult(response.result).view;
	}

	async closeExtensionView(address: ExtensionViewAddress) {
		await this.request({
			type: 'extension.view.close',
			...addressFields(address),
		});
	}

	async runExtensionViewAction(
		address: ExtensionViewAddress,
		event: ActionEvent,
	) {
		const response = await this.request({
			type: 'extension.view.action',
			...addressFields(address),
			event,
		});
		return parseActionResult(response.result);
	}

	async runExtensionCommand(
		projectPath: string,
		extensionId: string,
		commandId: string,
		sessionId?: string,
	) {
		await this.request({
			type: 'extension.command.run',
			projectPath,
			extensionId,
			commandId,
			...(sessionId ? { sessionId } : {}),
		});
	}

	async invokeProjectExtension(
		projectPath: string,
		extensionId: string,
		operation: string,
		input?: unknown,
	) {
		const response = await this.request({
			type: 'project.extension.invoke',
			projectPath,
			extensionId,
			operation,
			...(input === undefined ? {} : { input }),
		});
		return response.result;
	}
}

/** `sessionId` is optional on the wire; an explicit `undefined` is rejected. */
function addressFields({
	projectPath,
	extensionId,
	viewId,
	sessionId,
}: ExtensionViewAddress) {
	return {
		projectPath,
		extensionId,
		viewId,
		...(sessionId ? { sessionId } : {}),
	};
}
