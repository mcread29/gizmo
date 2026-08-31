import type { WorkspaceDirectoryListing } from '@gizmo/protocol';

export type CommandPaletteMode = 'root' | 'workspace';

/** The project operations needed by the workspace branch of the palette. */
export interface WorkspacePaletteStore {
	searchProjects(
		query: string,
		root?: string,
	): Promise<WorkspaceDirectoryListing>;
	addProject(projectPath: string): Promise<{ path: string }>;
}
