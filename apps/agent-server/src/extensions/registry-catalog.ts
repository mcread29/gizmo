import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RegistryCatalogEntry } from '@gizmo/protocol';
import {
	extensionsDir,
	disabledExtensionsDir,
	readRegistryManifest,
	registryCloneDir,
	registryExtensionsDir,
} from './registry-storage';

/** Builds the catalog: the registry's extensions plus their link state. */
export async function registryCatalog(
	linked: readonly string[],
): Promise<RegistryCatalogEntry[]> {
	const clone = registryCloneDir();
	const manifest = await readRegistryManifest(clone);
	const dir = registryExtensionsDir(clone, manifest);
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const meta = new Map(
		(manifest.extensions ?? []).map((extension) => [extension.id, extension]),
	);
	const catalog: RegistryCatalogEntry[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const id = entry.name;
		const isLinked = linked.includes(id);
		let extensionEntry: string | undefined;
		if (isLinked) {
			const disabled = join(disabledExtensionsDir(), id);
			extensionEntry = await lstat(disabled).then(
				() => disabled,
				() => join(extensionsDir(), id),
			);
		}
		catalog.push({
			id,
			name: meta.get(id)?.name ?? id,
			description: meta.get(id)?.description,
			linked: isLinked,
			...(extensionEntry ? { entry: extensionEntry } : {}),
		});
	}
	return catalog;
}
