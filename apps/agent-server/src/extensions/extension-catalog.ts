import type { GizmoServerExtension } from '@gizmo/extensions';
import { loadLinkedExtensionIntegrations } from './load-extensions';
import { registerExtensions, registeredExtensions } from './registry';

let configured: readonly GizmoServerExtension[] = [];
let linkedDir: string | undefined;
let linked: readonly GizmoServerExtension[] = [];
let generation = 0;

/** Configured extensions, with a linked extension of the same id winning. */
export function mergeExtensionCatalog(
	configuredExtensions: readonly GizmoServerExtension[],
	linkedExtensions: readonly GizmoServerExtension[],
): GizmoServerExtension[] {
	const linkedIds = new Set(linkedExtensions.map(({ id }) => id));
	return [
		...configuredExtensions.filter(({ id }) => !linkedIds.has(id)),
		...linkedExtensions,
	];
}

/**
 * Records where the catalog comes from so it can be rebuilt later. The
 * configured set is read once at boot; only the linked directory is rescanned.
 */
export function configureExtensionCatalog(options: {
	configured: readonly GizmoServerExtension[];
	linkedDir: string;
}): void {
	configured = options.configured;
	linkedDir = options.linkedDir;
}

/** Increments on every rescan; clients use it to tell reloads apart. */
export function extensionCatalogGeneration(): number {
	return generation;
}

/**
 * Rescans the linked extensions and re-registers the merged catalog, so a
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
	const merged = mergeExtensionCatalog(configured, linked);
	registerExtensions(merged);
	generation += 1;
	return merged;
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
