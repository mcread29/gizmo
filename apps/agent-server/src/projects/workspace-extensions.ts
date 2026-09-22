import { readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { WorkspaceExtension } from '@gizmo/protocol';

/**
 * Where a workspace keeps the extensions it offers its own sessions. Always
 * `/`-separated: the paths built from it are stored in a committed config,
 * and one written on Windows has to mean the same thing on every clone.
 */
export const workspaceExtensionsDir = '.gizmo/extensions';

/** A lone script is an extension too, exactly as in the linked directory. */
const scriptEntry = /\.[cm]?[jt]s$/;

/**
 * Lists what `<workspace>/.gizmo/extensions` holds: one entry per directory
 * (loaded through its `index.ts`) or single script. Listing is not loading —
 * this says what the workspace offers, and `piExtensionPaths` says what it
 * runs, so a freshly cloned repository executes nothing on its own. A
 * missing directory offers nothing rather than failing.
 */
export async function discoverWorkspaceExtensions(
	projectPath: string,
): Promise<WorkspaceExtension[]> {
	const dir = join(projectPath, workspaceExtensionsDir);
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const found: WorkspaceExtension[] = [];
	for (const entry of entries) {
		// A link counts as whatever it points at, so one to a README is not
		// offered and one to nowhere is not either.
		const target = entry.isSymbolicLink()
			? await stat(join(dir, entry.name)).catch(() => undefined)
			: entry;
		if (!target) continue;
		if (
			target.isDirectory() ||
			(target.isFile() && scriptEntry.test(entry.name))
		) {
			found.push({
				id: entry.name,
				path: `${workspaceExtensionsDir}/${entry.name}`,
			});
		}
	}
	return found.sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * The stored form of a relative path: `/`-separated whatever wrote it. An
 * absolute path belongs to one machine and is left exactly as typed.
 */
export function portablePath(path: string): string {
	return isAbsolute(path) ? path : path.replaceAll('\\', '/');
}

/** Absolute entry paths for the loader; a relative one is workspace-local. */
export function resolveExtensionPaths(
	projectPath: string,
	paths: readonly string[],
): string[] {
	return paths.map((path) =>
		isAbsolute(path) ? path : resolve(projectPath, portablePath(path)),
	);
}

/**
 * Stores a path the way the config wants it: relative and `/`-separated when
 * it points inside the workspace, so a committed `.gizmo/config.json`
 * travels with the repository, and absolute for anything living elsewhere on
 * the machine.
 */
export function storedExtensionPath(projectPath: string, path: string): string {
	const root = resolve(projectPath);
	const full = resolve(root, portablePath(path));
	// `relative` rather than a prefix test: on Windows it ignores case.
	const inside = relative(root, full);
	const isInside =
		inside !== '' && !inside.startsWith('..') && !isAbsolute(inside);
	return isInside ? inside.split(sep).join('/') : full;
}
