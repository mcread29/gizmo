import type { ExtensionDescriptor } from '@gizmo/protocol';
import type { ProjectService, ProjectServiceRegistry } from '@gizmo/extensions';
import type { ExtensionHostService } from '../extensions/extension-host-service';

export interface ProjectEmitters {
	status(
		sessionId: string,
		projectPath: string,
		extensionId: string,
		status: unknown,
	): void;
	extensions(
		sessionId: string,
		projectPath: string,
		extensions: ExtensionDescriptor[],
	): void;
}

export interface ProjectWatchCoordinator {
	/**
	 * Starts (or refreshes) the live watch for one extension's project
	 * service and resolves with that service's initial status.
	 */
	watch(
		sessionId: string,
		projectPath: string,
		extensionId: string,
	): Promise<unknown>;
}

/**
 * Coordinates the live project watches owned by one connection: one
 * workspace-extension watch per path, plus one watch per extension project
 * service that was subscribed to. Each service owns its watch lifecycle —
 * calling `watchStatus` again replaces the previous watch, and connection
 * teardown disposes the whole registry.
 */
export function createProjectWatchCoordinator(
	projectServices: ProjectServiceRegistry,
	extensionHost: ExtensionHostService,
	emit: ProjectEmitters,
): ProjectWatchCoordinator {
	let watched:
		| { path: string; stopExtensionWatch: () => void; extensions: Set<string> }
		| undefined;

	const subscribe = (
		service: ProjectService,
		sessionId: string,
		projectPath: string,
		extensionId: string,
	) =>
		service.watchStatus(projectPath, {
			status: (status) =>
				emit.status(sessionId, projectPath, extensionId, status),
		});

	return {
		watch(sessionId, projectPath, extensionId) {
			const service = projectServices.requireService(extensionId);
			if (watched?.path !== projectPath) {
				const previous = watched;
				previous?.stopExtensionWatch();
				const stopExtensionWatch = extensionHost.watch(
					projectPath,
					(extensions) => emit.extensions(sessionId, projectPath, extensions),
				);
				watched = {
					path: projectPath,
					stopExtensionWatch,
					extensions: new Set(),
				};
				// A service exposes no unwatch, only "watch again replaces the
				// previous watch". Re-point every service still watching the old
				// path so none keeps emitting for a project nobody is looking at.
				for (const previousId of previous?.extensions ?? []) {
					if (previousId === extensionId) continue;
					const previousService = projectServices.serviceFor(previousId);
					if (!previousService) continue;
					watched.extensions.add(previousId);
					void subscribe(
						previousService,
						sessionId,
						projectPath,
						previousId,
					).catch(() => {
						// Failure surfaces on the next explicit watch of this service.
					});
				}
			}
			const watch = watched;
			if (watch.extensions.has(extensionId)) {
				// Keep the existing listeners alive and only refresh its status.
				return service.getStatus(projectPath);
			}
			watch.extensions.add(extensionId);
			return subscribe(service, sessionId, projectPath, extensionId);
		},
	};
}
