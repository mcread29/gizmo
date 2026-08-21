import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GizmoServerExtension } from '@gizmo/extensions';

interface ExtensionsConfig {
	extensions: string[];
}

/**
 * Loads the extensions listed in a `gizmo.extensions.json` config by dynamic
 * import, so the server never names a specific extension package itself. Each
 * entry is a bare package specifier or filesystem path; its `<entry>/server`
 * subpath must export a `gizmoExtension`. A missing config file, or an entry
 * that fails to load, is skipped rather than failing startup.
 */
export async function loadServerExtensions(
	configPath: string,
): Promise<GizmoServerExtension[]> {
	const config = await readConfig(configPath);
	const loaded = await Promise.all(
		config.extensions.map((specifier) => loadExtension(specifier)),
	);
	return loaded.filter(
		(extension): extension is GizmoServerExtension => extension !== undefined,
	);
}

async function loadExtension(
	specifier: string,
): Promise<GizmoServerExtension | undefined> {
	try {
		const module: unknown = await import(`${specifier}/server`);
		const extension = (module as { gizmoExtension?: GizmoServerExtension })
			.gizmoExtension;
		if (!extension) {
			console.warn(
				`Extension "${specifier}" has no server entry (missing gizmoExtension export)`,
			);
		}
		// The package root lets resource discovery and web bundles find the
		// extension's shipped files (skills/, prompts/, dist/web.js).
		return extension && { ...extension, packageRoot: packageRoot(specifier) };
	} catch (error) {
		console.warn(`Failed to load extension "${specifier}":`, error);
		return undefined;
	}
}

function packageRoot(specifier: string): string | undefined {
	if (specifier.startsWith('.')) return undefined;
	try {
		// Resolve the entry the import just used; the exports map may not
		// expose ./package.json, but <pkg>/server always resolves here.
		const entry = fileURLToPath(import.meta.resolve(`${specifier}/server`));
		return dirname(dirname(dirname(entry)));
	} catch {
		return undefined;
	}
}

async function readConfig(path: string): Promise<ExtensionsConfig> {
	try {
		const raw = await readFile(path, 'utf8');
		const parsed: unknown = JSON.parse(raw);
		const extensions =
			parsed !== null && typeof parsed === 'object' && 'extensions' in parsed
				? (parsed as { extensions: unknown }).extensions
				: undefined;
		return { extensions: Array.isArray(extensions) ? extensions : [] };
	} catch {
		return { extensions: [] };
	}
}
