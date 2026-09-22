import type { CompactionPolicy } from '@gizmo/protocol';
import { reloadExtensions } from '../extensions/extension-reload';
import { validateCompactionPolicy } from '../projects/project-config-store';
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

	/**
	 * Replaces the project's explicit extension paths, then reloads so the
	 * catalog and idle runtimes pick them up without a restart.
	 */
	async setProjectExtensionPaths(projectPath: string, paths: string[]) {
		const config = await this.context.projects.setProjectExtensionPaths(
			projectPath,
			paths,
		);
		await reloadExtensions();
		return config;
	}

	getProjectCompaction(projectPath: string) {
		return this.context.projects.compactionFor(projectPath);
	}

	/**
	 * Stores the workspace's policy, re-arms its resident threads, and
	 * broadcasts the change so every client's meter and settings follow.
	 */
	async setProjectCompaction(projectPath: string, policy: CompactionPolicy) {
		validateCompactionPolicy(policy);
		const compaction = await this.context.projects.setCompaction(
			projectPath,
			policy,
		);
		this.context.operations.applyCompactionPolicy(projectPath, compaction);
		this.context.events.emit('server', {
			type: 'project.compaction.changed',
			projectPath,
			compaction,
		});
		return compaction;
	}

	async removeProject(projectPath: string) {
		const paths =
			await this.context.projects.projectExtensionPathsFor(projectPath);
		await this.context.projects.remove(projectPath);
		if (paths.length) await reloadExtensions();
	}

	setProjectHidden(projectPath: string, hidden: boolean) {
		return this.context.projects.setHidden(projectPath, hidden);
	}

	reorderProjects(paths: string[]) {
		return this.context.projects.reorder(paths);
	}
}
