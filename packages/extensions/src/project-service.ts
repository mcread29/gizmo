/** Status of the external tool a project extension runs, in whatever terms that tool uses. */
export interface ProjectStatus {
	state: string;
	ok: boolean;
	command: readonly string[];
	exitCode: number | null;
	durationMs: number;
	instances: readonly unknown[];
	errors: readonly unknown[];
	warnings: readonly unknown[];
	stderr?: string;
}

export interface ProjectWatchListeners {
	status: (status: ProjectStatus) => void;
}

/**
 * An extension's runtime project (open/status/watch/revert). Gizmo core only
 * ever holds one of these behind the interface; it never knows which
 * extension it is.
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
