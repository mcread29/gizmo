import { mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
	extensionsDir,
	extensionWebDir,
	readRegistryManifest,
	registryCloneDir,
	registryExtensionsDir,
	type InstalledRegistry,
	type RegistryManifest,
} from './registry-storage';

interface LinkedExtension {
	entry: string;
	web?: string;
}

export async function syncExtension(
	clone: string,
	manifest: RegistryManifest,
	id: string,
): Promise<LinkedExtension> {
	const sourceDir = registryExtensionsDir(clone, manifest);
	const dir = join(sourceDir, id);
	const entrySource = join(dir, 'index.ts');
	await readFile(entrySource); // throws with a clear ENOENT when absent
	const entry = join(extensionsDir(), id);
	const web = join(extensionWebDir(), `${id}.web.js`);
	await Promise.all([
		mkdir(extensionsDir(), { recursive: true }),
		mkdir(extensionWebDir(), { recursive: true }),
		rm(entry, { recursive: true, force: true }),
		rm(web, { force: true }),
		// Remove artifacts installed by the old flat-file layout.
		rm(join(extensionsDir(), `${id}.ts`), { force: true }),
		rm(join(extensionsDir(), `${id}.web.js`), { force: true }),
	]);
	await symlink(dir, entry, 'junction');

	const webSource = join(sourceDir, `${id}.web.js`);
	const hasWeb = await readFile(webSource)
		.then(() => true)
		.catch(() => false);
	if (!hasWeb) return { entry };
	await symlink(webSource, web, 'file');
	return { entry, web };
}

export function unlinkExtension(id: string): Promise<void> {
	return Promise.all([
		rm(join(extensionsDir(), id), { recursive: true, force: true }),
		rm(join(extensionsDir(), `${id}.ts`), { force: true }),
		rm(join(extensionWebDir(), `${id}.web.js`), { force: true }),
		// Clean up bundles installed before the dedicated web directory existed.
		rm(join(extensionsDir(), `${id}.web.js`), { force: true }),
	]).then(() => undefined);
}

export async function refreshLinked(registry: InstalledRegistry) {
	const clone = registryCloneDir(registry.name);
	const manifest = await readRegistryManifest(clone);
	for (const id of registry.linked) {
		try {
			await syncExtension(clone, manifest, id);
		} catch (error) {
			console.error(`Could not sync extension "${id}":`, error);
		}
	}
}
