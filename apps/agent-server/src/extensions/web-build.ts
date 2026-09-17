import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readExtensionManifest } from './extension-manifest';
import {
	extensionWebDir,
	readInstalledRegistries,
	readRegistryManifest,
	registryCloneDir,
	registryExtensionsDir,
} from './registry-storage';

/** Where an extension keeps its browser entry, if it has one. */
export const webEntryPath = (extensionDir: string) =>
	join(extensionDir, 'src', 'web', 'index.ts');

export const hasWebEntry = (extensionDir: string) =>
	access(webEntryPath(extensionDir))
		.then(() => true)
		.catch(() => false);

/**
 * Builds one extension's browser bundle with Gizmo's own builder, in a child
 * process so Vite never blocks the server. Gizmo owning the build is what
 * keeps the shared-module contract (Svelte, json-render, Zod) honest: a
 * registry no longer needs its own copy of the builder that can drift.
 */
export async function buildExtensionWebBundle(
	extensionDir: string,
	outFile: string,
): Promise<void> {
	const require = createRequire(import.meta.url);
	const tsx = require.resolve('tsx/cli');
	const cli = fileURLToPath(import.meta.resolve('@gizmo/extension-build/cli'));
	await mkdir(dirname(outFile), { recursive: true });
	// Build beside the installed bundle. Failed builds preserve the working
	// version; rename replaces old symlinks without writing into their target.
	const temporary = `${outFile}.${randomUUID()}.tmp`;
	try {
		await new Promise<void>((resolve, reject) => {
			execFile(
				process.execPath,
				[tsx, cli, extensionDir, '--out', temporary],
				{ cwd: extensionDir, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
				(error, _stdout, stderr) => {
					if (error) {
						reject(
							new Error(
								[error.message, String(stderr)].filter(Boolean).join('\n'),
							),
						);
					} else resolve();
				},
			);
		});
		await rename(temporary, outFile);
	} finally {
		await rm(temporary, { force: true });
	}
}

/**
 * Rebuilds the browser bundle of every linked registry extension that has a
 * web entry (or only `ids`, when given). Returns diagnostics rather than
 * throwing: one extension failing to build must not block the reload of the
 * others. Extensions with no web entry are left alone, so a registry that
 * still ships prebuilt bundles keeps working.
 */
export async function rebuildLinkedWebBundles(
	ids?: readonly string[],
	options: { force?: boolean } = {},
): Promise<string[]> {
	const diagnostics: string[] = [];
	for (const registry of await readInstalledRegistries()) {
		const clone = registryCloneDir(registry.name);
		const manifest = await readRegistryManifest(clone);
		const sourceDir = registryExtensionsDir(clone, manifest);
		for (const id of registry.linked) {
			if (ids && !ids.includes(id)) continue;
			const extensionDir = join(sourceDir, id);
			const outFile = join(extensionWebDir(), `${id}.web.js`);
			try {
				if ((await readExtensionManifest(extensionDir))?.web === false) {
					await rm(outFile, { force: true });
					continue;
				}
			} catch (error) {
				diagnostics.push(String(error));
				continue;
			}
			if (!(await hasWebEntry(extensionDir))) continue;
			// A build takes seconds per extension; skip the ones whose source
			// has not changed since the installed bundle was written.
			if (!options.force && !ids && (await bundleFresh(extensionDir, outFile)))
				continue;
			try {
				await buildExtensionWebBundle(extensionDir, outFile);
			} catch (error) {
				diagnostics.push(
					`Web bundle for "${id}" failed to build: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}
	}
	return diagnostics;
}

/** True when nothing under the extension changed after its bundle was built. */
async function bundleFresh(extensionDir: string, outFile: string) {
	try {
		const built = (await stat(outFile)).mtimeMs;
		return (await newestMtime(extensionDir)) <= built;
	} catch {
		return false;
	}
}

const skippedDirs = new Set(['node_modules', '.git', 'dist']);

async function newestMtime(dir: string): Promise<number> {
	let newest = 0;
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (skippedDirs.has(entry.name)) continue;
		const path = join(dir, entry.name);
		const time = entry.isDirectory()
			? await newestMtime(path)
			: (await stat(path)).mtimeMs;
		if (time > newest) newest = time;
	}
	return newest;
}
