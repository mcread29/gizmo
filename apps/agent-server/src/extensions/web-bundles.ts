import { readFile, readdir } from 'node:fs/promises';
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
/**
 * Browser bundles paired with installed Pi extensions live outside Pi's
 * auto-discovery directory. Every `<id>.web.js` in `dirs` is host-only code;
 * keeping it separate prevents Pi from executing Svelte browser imports.
 */
export async function piExtensionWebBundles(
	dirs: readonly string[],
): Promise<WebExtensionBundles> {
	const bundles: WebExtensionBundles['bundles'] = [];
	const diagnostics: string[] = [];
	const seen = new Set<string>();
	for (const dir of dirs) {
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (
				(!entry.isFile() && !entry.isSymbolicLink()) ||
				!entry.name.endsWith('.web.js')
			)
				continue;
			const id = entry.name.slice(0, -'.web.js'.length);
			if (!id || seen.has(id)) continue;
			const path = join(dir, entry.name);
			let code: string;
			try {
				code = await readFile(path, 'utf8');
			} catch {
				continue;
			}
			if (code.length > maxBundleBytes) {
				diagnostics.push(
					`Pi extension "${id}" web bundle is too large (${code.length} bytes)`,
				);
				continue;
			}
			seen.add(id);
			bundles.push({ id, code });
		}
	}
	return { bundles, diagnostics };
}

export async function webExtensionBundles(
	extensions: readonly GizmoServerExtension[],
	piExtensionDirs: readonly string[] = [],
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
