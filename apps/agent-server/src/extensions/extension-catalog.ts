import type { GizmoServerExtension } from '@gizmo/extensions';
import { loadLinkedExtensionIntegrations } from './load-extensions';
import { registerExtensions, registeredExtensions } from './registry';

let configured: readonly GizmoServerExtension[] = [];
let linkedDir: string | undefined;

/** Configured extensions, with a linked extension of the same id winning. */
export function mergeExtensionCatalog(
	configuredExtensions: readonly GizmoServerExtension[],
	linked: readonly GizmoServerExtension[],
): GizmoServerExtension[] {
	const linkedIds = new Set(linked.map(({ id }) => id));
	return [
		...configuredExtensions.filter(({ id }) => !linkedIds.has(id)),
		...linked,
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

/**
 * Rescans the linked extensions and re-registers the merged catalog, so a
 * registry link or unlink shows up without a restart. Everything that reads
 * `registeredExtensions()` picks the new catalog up on its next call.
 *
 * Before the catalog is configured (unit tests, or a server that never
 * booted through it) this is a no-op that returns what is registered.
 */
export async function rescanExtensionCatalog(): Promise<
	readonly GizmoServerExtension[]
> {
	if (!linkedDir) return registeredExtensions();
	const linked = await loadLinkedExtensionIntegrations(linkedDir);
	const merged = mergeExtensionCatalog(configured, linked);
	registerExtensions(merged);
	return merged;
}
