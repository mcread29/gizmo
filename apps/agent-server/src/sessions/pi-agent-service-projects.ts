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

	addProject(projectPath: string) {
		return this.context.projects.add(projectPath);
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

	removeProject(projectPath: string) {
		return this.context.projects.remove(projectPath);
	}

	reorderProjects(paths: string[]) {
		return this.context.projects.reorder(paths);
	}
}
