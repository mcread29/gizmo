import type { StoredProject } from '@gizmo/protocol';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';

/**
 * Catalog edits that change `store.projects`, kept beside the capability so
 * the optimistic update and its rollback read as one small unit each.
 */
export async function addProject(
	store: AgentStore,
	client: AgentClient,
	projectPath: string,
): Promise<StoredProject> {
	const project = await client.addProject(projectPath);
	store.projects = [
		project,
		...store.projects.filter(({ path }) => path !== project.path),
	];
	return project;
}

/**
 * Hiding only changes the catalog row: the workspace keeps its threads and
 * its config, so the sidebar can put it back at any time. Optimistic like
 * the reorder — the row leaves the list, then the server confirms.
 */
export async function setProjectHidden(
	store: AgentStore,
	client: AgentClient,
	projectPath: string,
	hidden: boolean,
): Promise<void> {
	const previous = store.projects;
	const replace = (next: StoredProject) => {
		store.projects = previous.map((project) =>
			project.path === projectPath ? next : project,
		);
	};
	const current = previous.find(({ path }) => path === projectPath);
	if (current) replace({ ...current, hidden });
	try {
		replace(await client.setProjectHidden(projectPath, hidden));
	} catch (error) {
		store.projects = previous;
		throw error;
	}
}

export async function removeProject(
	store: AgentStore,
	client: AgentClient,
	projectPath: string,
): Promise<void> {
	await client.removeProject(projectPath);
	store.projects = store.projects.filter(({ path }) => path !== projectPath);
}

/** Optimistic: the row lands where it was dropped, then the server confirms. */
export async function reorderProjects(
	store: AgentStore,
	client: AgentClient,
	paths: string[],
): Promise<void> {
	const previous = store.projects;
	const rank = new Map(paths.map((path, index) => [path, index]));
	store.projects = [...previous].sort(
		(left, right) =>
			(rank.get(left.path) ?? Number.POSITIVE_INFINITY) -
			(rank.get(right.path) ?? Number.POSITIVE_INFINITY),
	);
	try {
		store.projects = await client.reorderProjects(paths);
	} catch (error) {
		store.projects = previous;
		throw error;
	}
}
