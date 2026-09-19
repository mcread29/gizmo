import type { GizmoServerExtension } from '@gizmo/extensions';
import { loadLinkedExtensionIntegrations } from './load-extensions';
import { registerExtensions, registeredExtensions } from './registry';

let linkedDir: string | undefined;
let linked: readonly GizmoServerExtension[] = [];
let generation = 0;

/**
 * Records the directory the catalog is scanned from so it can be rebuilt
 * later. Every extension Gizmo runs is linked there from the registry.
 */
export function configureExtensionCatalog(options: {
	linkedDir: string;
}): void {
	linkedDir = options.linkedDir;
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
	linked = await loadLinkedExtensionIntegrations(linkedDir);
	registerExtensions(linked);
	generation += 1;
	return linked;
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
