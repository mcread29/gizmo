import { readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { GizmoServerExtension } from '@gizmo/extensions';

interface ExtensionsConfig {
	extensions: string[];
}

/** Loads transitional package-based extensions from Gizmo's config. */
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

/** Extension ids become map keys and file-path components; keep them tame. */
const extensionIdPattern = /^[a-z0-9][a-z0-9.-]*$/i;

/**
 * Loads optional Gizmo integration exported by installed Pi extensions.
 * The default export remains Pi's extension factory; Gizmo only recognizes
 * the generic named `gizmoExtension` capability object.
 */
export async function loadLinkedExtensionIntegrations(
	extensionsDir: string,
): Promise<GizmoServerExtension[]> {
	let entries;
	try {
		entries = await readdir(extensionsDir, { withFileTypes: true });
	} catch {
		return [];
	}
	const paths = entries.flatMap((entry) => {
		if (entry.isFile()) {
			return entry.name.endsWith('.ts')
				? [join(extensionsDir, entry.name)]
				: [];
		}
		return entry.isDirectory() || entry.isSymbolicLink()
			? [join(extensionsDir, entry.name, 'index.ts')]
			: [];
	});
	const loaded = await Promise.all(paths.map(loadLinkedIntegration));
	return loaded.filter(
		(extension): extension is GizmoServerExtension => extension !== undefined,
	);
}

async function loadLinkedIntegration(
	entry: string,
): Promise<GizmoServerExtension | undefined> {
	try {
		const source = await realpath(entry);
		const module: unknown = await import(pathToFileURL(source).href);
		return validateExtension(
			(module as { gizmoExtension?: GizmoServerExtension }).gizmoExtension,
			source,
			dirname(source),
		);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.warn(`Failed to load Gizmo integration from "${entry}":`, error);
		}
		return undefined;
	}
}

async function loadExtension(
	specifier: string,
): Promise<GizmoServerExtension | undefined> {
	try {
		const module: unknown = await import(`${specifier}/server`);
		return validateExtension(
			(module as { gizmoExtension?: GizmoServerExtension }).gizmoExtension,
			specifier,
			packageRoot(specifier),
		);
	} catch (error) {
		console.warn(`Failed to load extension "${specifier}":`, error);
		return undefined;
	}
}

function validateExtension(
	extension: GizmoServerExtension | undefined,
	source: string,
	root: string | undefined,
): GizmoServerExtension | undefined {
	if (!extension) return undefined;
	if (
		typeof extension.id !== 'string' ||
		!extensionIdPattern.test(extension.id)
	) {
		console.warn(
			`Extension "${source}" has an invalid id (${JSON.stringify(extension.id)}); ids are lowercase alphanumerics, dots, and dashes`,
		);
		return undefined;
	}
	return { ...extension, ...(root ? { packageRoot: root } : {}) };
}

function packageRoot(specifier: string): string | undefined {
	if (specifier.startsWith('.')) return undefined;
	try {
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
