import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { reloadExtensions } from '../extensions/extension-reload';
import { PiAgentServiceResources } from './pi-agent-service-resources';

/** Project catalog commands. */
export class PiAgentServiceProjects extends PiAgentServiceResources {
	listProjects() {
		return this.context.projects.list();
	}

	detectProject(projectPath: string) {
		return this.context.projects.detect(projectPath);
	}

	browseProjects(path?: string) {
		return this.context.projects.browse(path);
	}

	searchProjects(query: string, root?: string) {
		return this.context.projects.search(query, root);
	}

	async addProject(projectPath: string) {
		const project = await this.context.projects.add(projectPath);
		// A project that brings its own extensions joins the catalog now, not
		// at the next restart.
		if (existsSync(join(project.path, '.pi', 'extensions')))
			await reloadExtensions();
		return project;
	}

	setProjectGizmoExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		return this.context.projects.setGizmoExtension(
			projectPath,
			extensionId,
			enabled,
		);
	}

	setProjectPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		return this.context.projects.setPiExtension(
			projectPath,
			extensionId,
			enabled,
		);
	}

	async removeProject(projectPath: string) {
		await this.context.projects.remove(projectPath);
		if (existsSync(join(projectPath, '.pi', 'extensions')))
			await reloadExtensions();
	}

	reorderProjects(paths: string[]) {
		return this.context.projects.reorder(paths);
	}
}
