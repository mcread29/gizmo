import type { RegistryStatus } from '@gizmo/protocol';
import { rescanExtensionCatalog } from './extension-catalog';
import { catalogFor } from './registry-catalog';
import {
	buildRegistry,
	cloneRegistry,
	pullRegistry,
	registryCommit,
	registryName,
	registryUpdateAvailable,
} from './registry-git-build';
import {
	refreshLinked,
	syncExtension,
	unlinkExtension,
} from './registry-links';
import {
	ensureRegistryHome,
	readInstalledRegistries,
	readRegistryManifest,
	registryCloneDir,
	registryCloneExists,
	registryHome,
	removeRegistryClone,
	writeInstalledRegistries,
	type InstalledRegistry,
} from './registry-storage';

export { extensionWebDir } from './registry-storage';

/**
 * Extension registries are cloned and built in Gizmo-managed storage. Linking
 * exposes a registry extension to Pi while browser bundles remain in a
 * separate host-only directory.
 */
export async function registryStatus(): Promise<RegistryStatus> {
	const registries = await readInstalledRegistries();
	return {
		home: registryHome(),
		registries: await Promise.all(
			registries.map(async (registry) => {
				const clone = registryCloneDir(registry.name);
				const [extensions, updateAvailable] = await Promise.all([
					catalogFor(registry),
					registryUpdateAvailable(clone),
				]);
				return {
					name: registry.name,
					url: registry.url,
					...(registry.commit ? { commit: registry.commit } : {}),
					...(updateAvailable ? { updateAvailable: true } : {}),
					addedAt: registry.addedAt,
					extensions,
				};
			}),
		),
	};
}

export async function registryAdd(url: string): Promise<RegistryStatus> {
	const name = registryName(url);
	const clone = registryCloneDir(name);
	if (await registryCloneExists(clone)) {
		throw new Error(`A registry named "${name}" already exists`);
	}

	await ensureRegistryHome();
	try {
		await cloneRegistry(url, clone, registryHome());
		const manifest = await readRegistryManifest(clone);
		if (manifest.build) await buildRegistry(manifest.build, clone);
	} catch (error) {
		await removeRegistryClone(clone);
		throw error;
	}

	const registries = await readInstalledRegistries();
	registries.push({
		name,
		url,
		commit: await registryCommit(clone),
		addedAt: Date.now(),
		linked: [],
		extensions: [],
	});
	await writeInstalledRegistries(registries);
	return registryStatus();
}

export async function registryUpdate(name: string): Promise<RegistryStatus> {
	const registries = await readInstalledRegistries();
	const registry = findRegistry(registries, name);
	const clone = registryCloneDir(name);
	await pullRegistry(clone);
	const manifest = await readRegistryManifest(clone);
	if (manifest.build) await buildRegistry(manifest.build, clone);
	registry.commit = await registryCommit(clone);
	await refreshLinked(registry);
	await writeInstalledRegistries(registries);
	// The rescan re-imports each linked entry, but Node's ESM cache serves the
	// module graph it already loaded for an unchanged path, so an extension
	// that was linked before this update keeps running its old code until the
	// server restarts. Busting only the entry module would run new entry code
	// against stale dependencies, which is worse than being honestly stale.
	await rescanExtensionCatalog();
	return registryStatus();
}

export async function registryRemove(name: string): Promise<RegistryStatus> {
	const registries = await readInstalledRegistries();
	const registry = findRegistry(registries, name);
	for (const id of registry.linked) await unlinkExtension(id);
	await removeRegistryClone(registryCloneDir(name));
	await writeInstalledRegistries(
		registries.filter((candidate) => candidate.name !== name),
	);
	await rescanExtensionCatalog();
	return registryStatus();
}

export async function registryLink(
	name: string,
	id: string,
): Promise<RegistryStatus> {
	const registries = await readInstalledRegistries();
	const registry = findRegistry(registries, name);
	if (!registry.linked.includes(id)) registry.linked.push(id);
	const clone = registryCloneDir(name);
	const manifest = await readRegistryManifest(clone);
	await syncExtension(clone, manifest, id);
	await writeInstalledRegistries(registries);
	await rescanExtensionCatalog();
	return registryStatus();
}

export async function registryUnlink(
	name: string,
	id: string,
): Promise<RegistryStatus> {
	const registries = await readInstalledRegistries();
	const registry = findRegistry(registries, name);
	registry.linked = registry.linked.filter((linked) => linked !== id);
	await unlinkExtension(id);
	await writeInstalledRegistries(registries);
	await rescanExtensionCatalog();
	return registryStatus();
}

function findRegistry(registries: InstalledRegistry[], name: string) {
	const registry = registries.find((candidate) => candidate.name === name);
	if (!registry) throw new Error(`Registry "${name}" does not exist`);
	return registry;
}
