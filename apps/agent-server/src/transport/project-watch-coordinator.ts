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

/**
 * Coordinates the live project watches shared by every open connection: one
 * watch per path, plus one watch per extension project service. Watch events
 * go through the emitters, which broadcast to all sockets — every tab sees
 * the same project status, and a tab that closes takes nothing with it.
 *
 * A project service exposes no unwatch, only "watch again replaces the
 * previous watch", so each service effectively watches one path at a time.
 * The last tab to select a project wins the service's live updates; a tab
 * re-establishes its watch by selecting the project again, which the client
 * already does on every workspace change. Watches live for the server's
 * lifetime, not a connection's — a lingering watch on a path nobody has
 * selected only costs its status callbacks.
 */
export class ProjectWatchCoordinator {
	/** The path each service currently watches; watchStatus replaces in place. */
	readonly #watched = new Map<string, string>();
	/** One extension-host watch per path, shared by every service on it. */
	readonly #paths = new Map<
		string,
		{ stopExtensionWatch: () => void; services: Set<string> }
	>();

	constructor(
		private readonly projectServices: ProjectServiceRegistry,
		private readonly extensionHost: ExtensionHostService,
		private readonly emit: ProjectEmitters,
	) {}

	async watch(
		sessionId: string,
		projectPath: string,
		extensionId: string,
	): Promise<unknown> {
		const service = this.projectServices.requireService(extensionId);
		if (this.#watched.get(extensionId) === projectPath) {
			// Keep the existing listeners alive and only refresh its status.
			return service.getStatus(projectPath);
		}
		this.#leavePath(extensionId);
		const path = this.#joinPath(sessionId, projectPath);
		path.services.add(extensionId);
		this.#watched.set(extensionId, projectPath);
		return this.#subscribe(service, sessionId, projectPath, extensionId);
	}

	#subscribe(
		service: ProjectService,
		sessionId: string,
		projectPath: string,
		extensionId: string,
	) {
		return service.watchStatus(projectPath, {
			status: (status) =>
				this.emit.status(sessionId, projectPath, extensionId, status),
		});
	}

	#joinPath(sessionId: string, projectPath: string) {
		const existing = this.#paths.get(projectPath);
		if (existing) return existing;
		// The sessionId captured here is only the envelope's session tag; the
		// client keys project events on projectPath and extensionId.
		const stopExtensionWatch = this.extensionHost.watch(
			projectPath,
			(extensions) => this.emit.extensions(sessionId, projectPath, extensions),
		);
		const path = { stopExtensionWatch, services: new Set<string>() };
		this.#paths.set(projectPath, path);
		return path;
	}

	#leavePath(extensionId: string) {
		const previousPath = this.#watched.get(extensionId);
		if (!previousPath) return;
		const path = this.#paths.get(previousPath);
		if (!path) return;
		path.services.delete(extensionId);
		if (path.services.size === 0) {
			path.stopExtensionWatch();
			this.#paths.delete(previousPath);
		}
	}
}
