import { resolve } from 'node:path';
import type { CatalogProject } from './project-catalog-store';

/**
 * Hides or shows one catalog row. Nothing is deleted: the row, its threads
 * and its config all survive, the sidebar just stops listing it.
 */
export function withHidden(
	projects: CatalogProject[],
	path: string,
	hidden: boolean,
): { projects: CatalogProject[]; project: CatalogProject } {
	const wanted = resolve(path);
	const project = projects.find((item) => item.path === wanted);
	if (!project) {
		throw new Error(`Workspace is not registered with Gizmo: ${wanted}`);
	}
	const next: CatalogProject = { ...project, hidden };
	if (!hidden) delete next.hidden;
	return {
		projects: projects.map((item) => (item === project ? next : item)),
		project: next,
	};
}

/**
 * Applies a sidebar ordering. Paths the catalog does not know are ignored
 * and registered projects missing from `paths` keep their relative order
 * after the listed ones, so a stale client never drops a workspace.
 */
export function reordered(
	projects: CatalogProject[],
	paths: string[],
): CatalogProject[] {
	const byPath = new Map(projects.map((project) => [project.path, project]));
	const ordered = paths
		.map((path) => byPath.get(resolve(path)))
		.filter((project): project is CatalogProject => Boolean(project));
	const listed = new Set(ordered.map(({ path }) => path));
	return [...ordered, ...projects.filter(({ path }) => !listed.has(path))];
}
