import * as svelte from 'svelte';
// Svelte ships no types for its internal entry: it is not a public API. Gizmo
// only ever passes it through to a plugin bundle, never calls into it.
// @ts-expect-error -- untyped internal entry, intentionally opaque here
import * as svelteInternalClient from 'svelte/internal/client';

/**
 * Modules a runtime-loaded web extension must share with the host rather than
 * bundle. Two copies of the Svelte runtime cannot see each other's context or
 * reactivity graph, so a plugin that bundled its own would render but never
 * update and never read context.
 *
 * A plugin bundle is built with these specifiers rewritten to read from
 * `globalThis[hostModulesKey]`, which avoids depending on import-map support
 * in whichever webview Tauri uses on the host platform. Everything else a
 * plugin imports is bundled into it normally.
 */
export const sharedModules = {
	svelte,
	'svelte/internal/client': svelteInternalClient,
} as const;

export const hostModulesKey = '__gizmoHostModules__';

/** Publishes the shared modules so a loaded plugin bundle can reach them. */
export function publishHostModules(
	target: Record<string, unknown> = globalThis as never,
): void {
	target[hostModulesKey] = sharedModules;
}
