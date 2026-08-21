import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WebExtensionBundles } from '@gizmo/protocol';
import type { GizmoServerExtension } from '@gizmo/extensions';

/** Where `build-web-extension.ts` writes an extension's standalone web bundle. */
export const webBundlePath = (packageRoot: string): string =>
	join(packageRoot, 'dist', 'web.js');

/** A bundle large enough to be a mistake rather than a plugin. */
const maxBundleBytes = 8 * 1024 * 1024;

/**
 * Reads the prebuilt web bundle of every extension that ships one. The app
 * imports these at runtime, which is how a web extension the app's own build
 * never saw can still contribute UI.
 *
 * An extension with no `packageRoot`, or no built bundle, simply contributes
 * nothing — a first-party extension the app already bundles statically is the
 * normal case for that.
 */
export async function webExtensionBundles(
	extensions: readonly GizmoServerExtension[],
): Promise<WebExtensionBundles> {
	const bundles: WebExtensionBundles['bundles'] = [];
	const diagnostics: string[] = [];
	for (const extension of extensions) {
		if (!extension.packageRoot) continue;
		const path = webBundlePath(extension.packageRoot);
		let code: string;
		try {
			code = await readFile(path, 'utf8');
		} catch {
			// Not every extension ships web UI, and a package may simply not have
			// been built yet. Neither is an error worth surfacing.
			continue;
		}
		if (code.length > maxBundleBytes) {
			diagnostics.push(
				`Extension "${extension.id}" web bundle is too large (${code.length} bytes)`,
			);
			continue;
		}
		bundles.push({ id: extension.id, code });
	}
	return { bundles, diagnostics };
}
