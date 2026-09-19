import { lstat, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
	extensionsDir,
	disabledExtensionsDir,
	readRegistryManifest,
	registryCloneDir,
	registryExtensionsDir,
	type RegistryManifest,
} from './registry-storage';

export function validateExtensionId(id: string): void {
	if (!/^[a-z0-9][a-z0-9.-]*$/i.test(id)) {
		throw new Error(`Invalid extension id: ${id}`);
	}
}

/** Links a registry extension into Gizmo's extensions directory and returns the link. */
export async function syncExtension(
	clone: string,
	manifest: RegistryManifest,
	id: string,
): Promise<string> {
	validateExtensionId(id);
	const dir = join(registryExtensionsDir(clone, manifest), id);
	await readFile(join(dir, 'index.ts')); // throws with a clear ENOENT when absent
	const disabled = await lstat(join(disabledExtensionsDir(), id)).then(
		() => true,
		() => false,
	);
	const root = disabled ? disabledExtensionsDir() : extensionsDir();
	const entry = join(root, id);
	await mkdir(root, { recursive: true });
	// One location per extension: a stale entry on the other side would
	// otherwise leave the same id both enabled and disabled.
	await rm(join(extensionsDir(), id), { recursive: true, force: true });
	await rm(join(disabledExtensionsDir(), id), { recursive: true, force: true });
	await symlink(dir, entry, 'junction');
	return entry;
}

export function unlinkExtension(id: string): Promise<void> {
	validateExtensionId(id);
	return Promise.all([
		rm(join(extensionsDir(), id), { recursive: true, force: true }),
		rm(join(disabledExtensionsDir(), id), { recursive: true, force: true }),
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
