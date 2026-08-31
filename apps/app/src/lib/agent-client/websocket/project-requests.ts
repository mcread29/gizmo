import {
	parseExtensions,
	parseProjectConfig,
	parseProjectDomains,
	parseProjectStatus,
	parseStoredProjects,
	parseUnityOpenProjectResult,
	parseWebExtensionBundles,
	parseWorkspaceDirectoryListing,
} from '@gizmo/protocol';
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

	async getProjectStatus(projectPath: string) {
		const response = await this.request({
			type: 'project.status',
			projectPath,
		});
		return parseProjectStatus(response.result);
	}

	async watchProjectStatus(sessionId: string, projectPath: string) {
		const response = await this.request({
			type: 'project.watch',
			sessionId,
			projectPath,
		});
		return parseProjectStatus(response.result);
	}

	async openProject(projectPath: string) {
		const response = await this.request({
			type: 'project.open',
			projectPath,
		});
		return parseUnityOpenProjectResult(response.result);
	}

	async listProjectExtensions(projectPath: string) {
		const response = await this.request({
			type: 'project.extensions',
			projectPath,
		});
		return parseExtensions(response.result);
	}

	async listWebExtensionBundles() {
		const response = await this.request({ type: 'extensions.web' });
		return parseWebExtensionBundles(response.result);
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
