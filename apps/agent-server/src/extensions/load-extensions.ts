import { readFile } from 'node:fs/promises';
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
		return extension;
	} catch (error) {
		console.warn(`Failed to load extension "${specifier}":`, error);
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
