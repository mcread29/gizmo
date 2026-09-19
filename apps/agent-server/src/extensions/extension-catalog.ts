import type { GizmoServerExtension } from '@gizmo/extension-api';
import {
	loadLinkedExtensionIntegrations,
	loadProjectExtensionIntegrations,
} from './load-extensions';
import { notifyExtensionUiChanged } from './extension-reload';
import { registerExtensions, registeredExtensions } from './registry';

let linkedDir: string | undefined;
let projectEntries:
	(() => Promise<{ workspaceRoot: string; paths: string[] }[]>) | undefined;
let linked: readonly GizmoServerExtension[] = [];
let generation = 0;

/**
 * Records the directory the catalog is scanned from so it can be rebuilt
 * later. Every extension Gizmo runs is linked there from the registry.
 */
export function configureExtensionCatalog(options: {
	linkedDir: string;
	/**
	 * Explicit per-project extension paths from each project's Gizmo config.
	 * Omitted loads no project extensions.
	 */
	projectExtensions?: () => Promise<
		{ workspaceRoot: string; paths: string[] }[]
	>;
}): void {
	linkedDir = options.linkedDir;
	projectEntries = options.projectExtensions;
}

/** Increments on every rescan; clients use it to tell reloads apart. */
export function extensionCatalogGeneration(): number {
	return generation;
}

/**
 * Rescans the linked extensions and re-registers the catalog, so a
 * registry link, unlink, or edit shows up without a restart. The linked
 * module graph is re-evaluated from disk, so every previously linked
 * extension is disposed first: the code that created it is being replaced.
 * Everything that reads `registeredExtensions()` picks the new catalog up on
 * its next call.
 *
 * Before the catalog is configured (unit tests, or a server that never
 * booted through it) this is a no-op that returns what is registered.
 */
export async function rescanExtensionCatalog(): Promise<
	readonly GizmoServerExtension[]
> {
	if (!linkedDir) return registeredExtensions();
	await disposeExtensions(linked);
	const global = await loadLinkedExtensionIntegrations(linkedDir);
	const local: GizmoServerExtension[] = [];
	for (const { workspaceRoot, paths } of (await projectEntries?.()) ?? []) {
		local.push(
			...(await loadProjectExtensionIntegrations(paths, workspaceRoot)),
		);
	}
	const taken = new Set(global.map(({ id }) => id));
	// A workspace extension never shadows a global one: the global id is
	// what every workspace's enablement refers to.
	linked = [
		...global,
		...local.filter((extension) => {
			if (!taken.has(extension.id)) return true;
			console.warn(
				`Workspace extension "${extension.id}" in ${extension.workspaceRoot} is shadowed by a global extension of the same id`,
			);
			return false;
		}),
	];
	await activateExtensions(linked);
	registerExtensions(linked);
	generation += 1;
	return linked;
}

async function activateExtensions(extensions: readonly GizmoServerExtension[]) {
	for (const extension of extensions) {
		try {
			await extension.activate?.({
				uiChanged: (workspacePath) =>
					notifyExtensionUiChanged(extension.id, workspacePath),
			});
		} catch (error) {
			console.warn(`Extension "${extension.id}" failed to activate:`, error);
		}
	}
}

async function disposeExtensions(extensions: readonly GizmoServerExtension[]) {
	for (const extension of extensions) {
		try {
			await extension.dispose?.();
		} catch (error) {
			// One extension failing to clean up must not block the reload.
			console.warn(`Extension "${extension.id}" failed to dispose:`, error);
		}
	}
}
