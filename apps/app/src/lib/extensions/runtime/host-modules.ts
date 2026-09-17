import * as svelte from 'svelte';
import * as jsonRenderCore from '@json-render/core';
import * as jsonRenderSvelte from '@json-render/svelte';
import * as jsonRenderSchema from '@json-render/svelte/schema';
import * as zod from 'zod';
import * as designFormat from '@gizmo/design/format';
import * as designHighlight from '@gizmo/design/highlight';
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
 * in every browser the app is served to. json-render and Zod are also shared
 * so extensions can use the host's pinned versions. Other imports are bundled.
 */
// Module namespace objects are already read-only per spec; freezing the
// container stops a plugin from replacing `sharedModules.svelte` itself and
// handing a poisoned module to every other extension sharing this global.
export const sharedModules = Object.freeze({
	svelte,
	'svelte/internal/client': svelteInternalClient,
	'@json-render/core': jsonRenderCore,
	'@json-render/svelte': jsonRenderSvelte,
	'@json-render/svelte/schema': jsonRenderSchema,
	zod,
	'@gizmo/design/format': designFormat,
	'@gizmo/design/highlight': designHighlight,
});

export const hostModulesKey = '__gizmoHostModules__';

/**
 * Publishes the shared modules so a loaded plugin bundle can reach them.
 * Defined non-writable and non-configurable so a plugin cannot swap out the
 * whole set for one it controls and hand a poisoned runtime to extensions
 * loaded afterward.
 */
export function publishHostModules(
	target: Record<string, unknown> = globalThis as never,
): void {
	if (target[hostModulesKey] === sharedModules) return;
	Object.defineProperty(target, hostModulesKey, {
		value: sharedModules,
		writable: false,
		configurable: false,
		enumerable: false,
	});
}
