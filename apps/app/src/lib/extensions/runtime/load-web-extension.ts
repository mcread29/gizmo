import type { WebExtensionBundle } from '@gizmo/protocol';
import type { GizmoWebExtension } from '../types';
import { publishHostModules } from './host-modules';

/**
 * Loads a web extension the app's own build never saw.
 *
 * Vite — like any bundler — resolves import specifiers by static analysis at
 * build time, so a plugin installed later cannot be reached by an ordinary
 * import. The way around it is a genuine runtime `import()` of a URL the
 * bundler cannot analyse: the JS engine resolves that itself. The bundle
 * arrives as source over the existing agent connection and is turned into a
 * blob URL here, so no extra HTTP server is needed.
 *
 * This requires `script-src ... blob:` in the Tauri CSP; see tauri.conf.json.
 */
export async function loadWebExtension(
	bundle: WebExtensionBundle,
): Promise<GizmoWebExtension> {
	publishHostModules();
	const url = URL.createObjectURL(
		new Blob([bundle.code], { type: 'text/javascript' }),
	);
	try {
		const module: unknown = await import(/* @vite-ignore */ url);
		return validate(bundle.id, module);
	} finally {
		// The module stays live once evaluated; the URL is only needed to fetch it.
		URL.revokeObjectURL(url);
	}
}

/**
 * Loads every bundle, keeping the ones that work. One broken plugin must not
 * take the app's whole extension surface down with it.
 */
export async function loadWebExtensions(
	bundles: readonly WebExtensionBundle[],
): Promise<{ extensions: GizmoWebExtension[]; diagnostics: string[] }> {
	const extensions: GizmoWebExtension[] = [];
	const diagnostics: string[] = [];
	const results = await Promise.all(
		bundles.map(async (bundle) => {
			try {
				return { extension: await loadWebExtension(bundle) };
			} catch (error) {
				return {
					diagnostic: `Failed to load web extension "${bundle.id}": ${
						error instanceof Error ? error.message : String(error)
					}`,
				};
			}
		}),
	);
	for (const result of results) {
		if (result.extension) extensions.push(result.extension);
		if (result.diagnostic) diagnostics.push(result.diagnostic);
	}
	return { extensions, diagnostics };
}

function validate(id: string, module: unknown): GizmoWebExtension {
	const exported =
		module !== null &&
		typeof module === 'object' &&
		'gizmoWebExtension' in module
			? (module as { gizmoWebExtension: unknown }).gizmoWebExtension
			: undefined;
	if (exported === null || typeof exported !== 'object') {
		throw new Error('bundle does not export a gizmoWebExtension object');
	}
	const extension = exported as GizmoWebExtension;
	if (typeof extension.id !== 'string' || !extension.id) {
		throw new Error('gizmoWebExtension has no id');
	}
	// The id is the identity the server dispatches on; a bundle claiming a
	// different one would let an extension impersonate another.
	if (extension.id !== id) {
		throw new Error(
			`bundle declares id "${extension.id}" but was served as "${id}"`,
		);
	}
	return extension;
}
