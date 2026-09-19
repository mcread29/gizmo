import { readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { GizmoServerExtension } from '@gizmo/extensions';
import { createJiti } from 'jiti';
import { readExtensionManifest } from './extension-manifest';

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
	// Registry extensions are always directories, linked in as junctions.
	const paths = entries.flatMap((entry) =>
		entry.isDirectory() || entry.isSymbolicLink()
			? [join(extensionsDir, entry.name, 'index.ts')]
			: [],
	);
	// Every scan gets its own jiti instance with the module cache off, exactly
	// as Pi loads the same files: the whole extension graph re-evaluates from
	// disk, so a reload after an edit runs the new code. Native `import()`
	// would pin the first graph for the life of the process. Packages under
	// node_modules still resolve natively and stay shared with the server.
	const jiti = createJiti(import.meta.url, { moduleCache: false });
	// jiti/tsx compilation is CPU-bound and contends heavily when several large
	// extension graphs initialize at once. Sequential imports are faster in
	// practice and make startup latency predictable.
	const loaded: GizmoServerExtension[] = [];
	for (const path of paths) {
		const extension = await loadLinkedIntegration(path, (file) =>
			jiti.import(file),
		);
		if (extension) loaded.push(extension);
	}
	return loaded;
}

async function loadLinkedIntegration(
	entry: string,
	importModule: (path: string) => Promise<unknown>,
): Promise<GizmoServerExtension | undefined> {
	try {
		const source = await realpath(entry);
		await readExtensionManifest(dirname(source));
		// Most Pi extensions have no Gizmo integration. Avoid executing and
		// transpiling every global extension merely to discover that the named
		// export is absent; a real named export must appear in the module source.
		const code = await readFile(source, 'utf8');
		if (!/\bgizmoExtension\b/.test(code)) return undefined;
		const module: unknown = await importModule(source);
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
