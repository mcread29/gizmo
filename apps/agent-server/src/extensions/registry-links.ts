import { lstat, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
	extensionsDir,
	disabledExtensionsDir,
	extensionWebDir,
	readRegistryManifest,
	registryCloneDir,
	registryExtensionsDir,
	type RegistryManifest,
} from './registry-storage';
import { buildExtensionWebBundle, hasWebEntry } from './web-build';
import {
	readExtensionManifest,
	validateExtensionId,
} from './extension-manifest';

interface LinkedExtension {
	entry: string;
	web?: string;
}

export async function syncExtension(
	clone: string,
	manifest: RegistryManifest,
	id: string,
): Promise<LinkedExtension> {
	validateExtensionId(id);
	const sourceDir = registryExtensionsDir(clone, manifest);
	const dir = join(sourceDir, id);
	const metadata = await readExtensionManifest(dir);
	const entrySource = join(dir, 'index.ts');
	await readFile(entrySource); // throws with a clear ENOENT when absent
	const disabled = await lstat(join(disabledExtensionsDir(), id)).then(
		() => true,
		() => false,
	);
	const root = disabled ? disabledExtensionsDir() : extensionsDir();
	const entry = join(root, id);
	const web = join(extensionWebDir(), `${id}.web.js`);
	// Gizmo builds the browser bundle itself whenever the extension ships a web
	// entry; `web: false` in the manifest opts out.
	const buildsWeb = metadata?.web !== false && (await hasWebEntry(dir));
	if (buildsWeb) await buildExtensionWebBundle(dir, web);
	await Promise.all([
		mkdir(root, { recursive: true }),
		mkdir(extensionWebDir(), { recursive: true }),
		rm(entry, { recursive: true, force: true }),
		...(buildsWeb ? [] : [rm(web, { force: true })]),
	]);
	await symlink(dir, entry, 'junction');
	return buildsWeb ? { entry, web } : { entry };
}

export function unlinkExtension(id: string): Promise<void> {
	validateExtensionId(id);
	return Promise.all([
		rm(join(extensionsDir(), id), { recursive: true, force: true }),
		rm(join(disabledExtensionsDir(), id), { recursive: true, force: true }),
		rm(join(extensionWebDir(), `${id}.web.js`), { force: true }),
	]).then(() => undefined);
}

export async function refreshLinked(linked: readonly string[]) {
	const clone = registryCloneDir();
	const manifest = await readRegistryManifest(clone);
	for (const id of linked) {
		try {
			await syncExtension(clone, manifest, id);
		} catch (error) {
			console.error(`Could not sync extension "${id}":`, error);
		}
	}
}
