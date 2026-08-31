import type { ExtensionDescriptor } from '@gizmo/protocol';
import type { ProjectService, ProjectStatus } from '@gizmo/extensions';
import type { ExtensionHostService } from '../extensions/extension-host-service';

export interface ProjectEmitters {
	status(sessionId: string, projectPath: string, status: ProjectStatus): void;
	extensions(
		sessionId: string,
		projectPath: string,
		extensions: ExtensionDescriptor[],
	): void;
}

export interface ProjectWatchCoordinator {
	watch(sessionId: string, projectPath: string): Promise<ProjectStatus>;
}

/** Coordinates the single live project watch owned by one connection. */
export function createProjectWatchCoordinator(
	projectService: ProjectService,
	extensionHost: ExtensionHostService,
	emit: ProjectEmitters,
): ProjectWatchCoordinator {
	let watchedProject:
		{ path: string; stopExtensionWatch: () => void } | undefined;

	return {
		watch(sessionId, projectPath) {
			if (watchedProject?.path === projectPath) {
				// Keep the existing listeners alive and only refresh its status.
				return projectService.getStatus(projectPath);
			}

			watchedProject?.stopExtensionWatch();
			const stopExtensionWatch = extensionHost.watch(
				projectPath,
				(extensions) => emit.extensions(sessionId, projectPath, extensions),
			);
			watchedProject = { path: projectPath, stopExtensionWatch };
			return projectService.watchStatus(projectPath, {
				status: (status) => emit.status(sessionId, projectPath, status),
			});
		},
	};
}
