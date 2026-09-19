import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RegistryCatalogEntry } from '@gizmo/protocol';
import { readExtensionManifest } from './extension-manifest';
import {
	extensionsDir,
	disabledExtensionsDir,
	extensionWebDir,
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
		// Unsupported extensions must remain visible so users can unlink them.
		const metadata = await readExtensionManifest(join(dir, id), false);
		const isLinked = linked.includes(id);
		let extensionEntry: string | undefined;
		let web: string | undefined;
		if (isLinked) {
			const disabled = join(disabledExtensionsDir(), id);
			extensionEntry = await lstat(disabled).then(
				() => disabled,
				() => join(extensionsDir(), id),
			);
			if (metadata?.web !== false)
				web = join(extensionWebDir(), `${id}.web.js`);
		}
		catalog.push({
			id,
			name: meta.get(id)?.name ?? id,
			description: meta.get(id)?.description,
			linked: isLinked,
			...(extensionEntry ? { entry: extensionEntry } : {}),
			...(web ? { web } : {}),
		});
	}
	return catalog;
}
