import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RegistryStatus } from '@gizmo/protocol';
import {
	extensionsDir,
	extensionWebDir,
	readRegistryManifest,
	registryCloneDir,
	registryExtensionsDir,
	type InstalledRegistry,
} from './registry-storage';

/** Builds the catalog for one registry: available extensions + link state. */
export async function catalogFor(
	registry: InstalledRegistry,
): Promise<RegistryStatus['registries'][number]['extensions']> {
	const clone = registryCloneDir(registry.name);
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
	const catalog: RegistryStatus['registries'][number]['extensions'] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const id = entry.name;
		const linked = registry.linked.includes(id);
		let extensionEntry: string | undefined;
		let web: string | undefined;
		if (linked) {
			extensionEntry = join(extensionsDir(), id);
			web = join(extensionWebDir(), `${id}.web.js`);
		}
		catalog.push({
			id,
			name: meta.get(id)?.name ?? id,
			description: meta.get(id)?.description,
			linked,
			...(extensionEntry ? { entry: extensionEntry } : {}),
			...(web ? { web } : {}),
		});
	}
	return catalog;
}
