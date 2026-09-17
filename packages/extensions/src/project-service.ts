/**
 * Status of the external tool a project extension runs. Opaque to Gizmo
 * core: the extension owns the payload's shape, validation, and errors, and
 * consumers on the wire validate whichever extension's data they render.
 */
export type ProjectStatus = unknown;

export interface ProjectWatchListeners {
	status: (status: ProjectStatus) => void;
}

/**
 * An extension's runtime project operations (status/watch/open/revert).
 * Gizmo core registers one of these per extension id and routes every
 * request to the owning extension's service; it never interprets payloads.
 */
export interface ProjectService {
	getStatus(projectPath: string): Promise<ProjectStatus>;
	watchStatus(
		projectPath: string,
		listeners: ProjectWatchListeners,
	): Promise<ProjectStatus>;
	openProject(projectPath: string): Promise<unknown>;
	revertFile(projectPath: string, file: string, patch: string): Promise<void>;
	dispose(): void;
}

/**
 * Holds one ProjectService per extension id. Requests name the extension
 * they belong to and are routed directly; there is no fallback order and no
 * implicit "first service wins" routing.
 */
export class ProjectServiceRegistry {
	#services: Map<string, ProjectService>;

	constructor(entries: Iterable<readonly [string, ProjectService]>) {
		this.#services = new Map(entries);
	}

	/**
	 * Swaps in a freshly created set of services after an extension reload.
	 * Every previous service is disposed, since the extension code that
	 * created it has been replaced; the ids whose service was replaced or
	 * dropped are returned so watchers can re-subscribe.
	 */
	replace(entries: Iterable<readonly [string, ProjectService]>): {
		replaced: string[];
		removed: string[];
	} {
		const previous = this.#services;
		this.#services = new Map(entries);
		for (const service of previous.values()) {
			try {
				service.dispose();
			} catch {
				// One service failing to dispose must not prevent the rest.
			}
		}
		const replaced = [...previous.keys()].filter((id) =>
			this.#services.has(id),
		);
		const removed = [...previous.keys()].filter(
			(id) => !this.#services.has(id),
		);
		return { replaced, removed };
	}

	get ids(): readonly string[] {
		return [...this.#services.keys()];
	}

	/** Registration order preserved; used only by v25 compatibility routing. */
	get entries(): readonly (readonly [string, ProjectService])[] {
		return [...this.#services.entries()];
	}

	serviceFor(extensionId: string): ProjectService | undefined {
		return this.#services.get(extensionId);
	}

	/** Like `serviceFor`, but throws when no service owns the extension. */
	requireService(extensionId: string): ProjectService {
		const service = this.#services.get(extensionId);
		if (!service) {
			throw new Error(
				`No project service is registered for extension "${extensionId}"`,
			);
		}
		return service;
	}

	dispose(): void {
		for (const service of this.#services.values()) {
			try {
				service.dispose();
			} catch {
				// One service failing to dispose must not prevent the rest.
			}
		}
	}
}
