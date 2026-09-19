import {
	parseExtensions,
	parseProjectConfig,
	parseProjectDomains,
	parseActionResult,
	parseExtensionsUi,
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

	async removeProject(projectPath: string) {
		await this.request({ type: 'project.remove', projectPath });
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

	async openExtensionView(
		address: ExtensionViewAddress,
		settings?: Record<string, unknown>,
	) {
		const response = await this.request({
			type: 'extension.view.open',
			...addressFields(address),
			...(settings ? { settings } : {}),
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
