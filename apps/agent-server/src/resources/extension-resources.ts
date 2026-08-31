import { readFile, readdir } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { GizmoServerExtension } from '@gizmo/extensions';
import { isPathWithin } from '../path-utils';

export interface ExtensionResourceRoots {
	skills: string[];
	prompts: string[];
}

/** What Pi looks for when a package declares nothing explicitly. */
const conventionDirs: ExtensionResourceRoots = {
	skills: ['skills'],
	prompts: ['prompts'],
};

/**
 * Skill and prompt directories shipped by loaded extensions, using Pi's own
 * package convention rather than a Gizmo-specific one: a `pi` key in the
 * package's `package.json` (`{ "pi": { "skills": ["./skills"] } }`) if present,
 * otherwise the conventional `skills/` and `prompts/` directories.
 *
 * Only directories that actually exist are returned. Contributing a skill this
 * way installs it; enablement still runs through the normal resource catalog,
 * so shipping a skill never silently turns it on.
 */
export async function extensionResourceRoots(
	extensions: readonly GizmoServerExtension[],
): Promise<ExtensionResourceRoots> {
	const roots = await Promise.all(
		extensions
			.filter((extension) => extension.packageRoot)
			.map((extension) => packageResourceRoots(extension.packageRoot!)),
	);
	return {
		skills: roots.flatMap(({ skills }) => skills),
		prompts: roots.flatMap(({ prompts }) => prompts),
	};
}

/** The declared or conventional resource directories of one package. */
export async function packageResourceRoots(
	packageRoot: string,
): Promise<ExtensionResourceRoots> {
	const root = resolve(packageRoot);
	const declared = await readPiManifest(root);
	const candidates = declared ?? conventionDirs;
	const [skills, prompts] = await Promise.all([
		existing(root, candidates.skills),
		existing(root, candidates.prompts),
	]);
	return { skills, prompts };
}

async function readPiManifest(
	root: string,
): Promise<ExtensionResourceRoots | undefined> {
	let manifest: unknown;
	try {
		manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
	} catch {
		// No manifest is fine; the convention directories still apply.
		return undefined;
	}
	const pi =
		manifest !== null && typeof manifest === 'object' && 'pi' in manifest
			? (manifest as { pi: unknown }).pi
			: undefined;
	if (pi === null || typeof pi !== 'object') return undefined;
	const entry = pi as { skills?: unknown; prompts?: unknown };
	// A `pi` key that mentions neither falls back to the convention rather than
	// silently contributing nothing.
	if (entry.skills === undefined && entry.prompts === undefined) {
		return undefined;
	}
	return {
		skills: stringList(entry.skills),
		prompts: stringList(entry.prompts),
	};
}

function stringList(value: unknown): string[] {
	if (typeof value === 'string') return [value];
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Resolves each declared directory inside the package and drops the ones that
 * are absent or escape the package root — a manifest cannot reach out and
 * contribute arbitrary directories from the host machine.
 */
async function existing(root: string, dirs: string[]): Promise<string[]> {
	const found: string[] = [];
	for (const dir of dirs) {
		if (isAbsolute(dir)) continue;
		const path = resolve(root, dir);
		if (!isPathWithin(root, path)) continue;
		try {
			await readdir(path);
			found.push(path);
		} catch {
			// A declared directory the package does not actually ship.
		}
	}
	return found;
}
