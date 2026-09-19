import type { RegistryStatus } from '@gizmo/protocol';
import { reloadExtensions } from './extension-reload';
import { registryCatalog } from './registry-catalog';
import {
	buildRegistry,
	cloneRegistry,
	pullRegistry,
	registryCommit,
	registryUpdateAvailable,
} from './registry-git-build';
import {
	refreshLinked,
	syncExtension,
	unlinkExtension,
} from './registry-links';
import {
	ensureRegistryHome,
	readInstalledState,
	readRegistryManifest,
	registryCloneDir,
	registryCloneExists,
	registryUrl,
	removeRegistryClone,
	writeInstalledState,
} from './registry-storage';

export { extensionWebDir } from './registry-storage';

/**
 * Gizmo installs extensions from exactly one registry: its own `gizmo-registry`
 * repository, cloned and built in Gizmo-managed storage. Linking exposes a
 * registry extension to Pi while browser bundles stay in a host-only directory.
 */
export async function registryStatus(): Promise<RegistryStatus> {
	await ensureClone();
	const clone = registryCloneDir();
	const installed = await readInstalledState();
	const [extensions, updateAvailable] = await Promise.all([
		registryCatalog(installed.linked),
		registryUpdateAvailable(clone),
	]);
	return {
		home: clone,
		url: registryUrl,
		...(installed.commit ? { commit: installed.commit } : {}),
		...(updateAvailable ? { updateAvailable: true } : {}),
		extensions,
	};
}

export async function registryUpdate(): Promise<RegistryStatus> {
	const clone = registryCloneDir();
	await ensureClone();
	await pullRegistry(clone);
	const manifest = await readRegistryManifest(clone);
	if (manifest.build) await buildRegistry(manifest.build, clone);
	const installed = await readInstalledState();
	await refreshLinked(installed.linked);
	await writeInstalledState({
		...installed,
		...commitField(await registryCommit(clone)),
	});
	// A full reload: linked extensions re-evaluate from disk, project services
	// are recreated, idle Pi runtimes reload, and every client is told.
	await reloadExtensions();
	return registryStatus();
}

export async function registryLink(id: string): Promise<RegistryStatus> {
	await ensureClone();
	const installed = await readInstalledState();
	if (!installed.linked.includes(id)) installed.linked.push(id);
	const clone = registryCloneDir();
	await syncExtension(clone, await readRegistryManifest(clone), id);
	await writeInstalledState(installed);
	await reloadExtensions();
	return registryStatus();
}

export async function registryUnlink(id: string): Promise<RegistryStatus> {
	const installed = await readInstalledState();
	installed.linked = installed.linked.filter((linked) => linked !== id);
	await unlinkExtension(id);
	await writeInstalledState(installed);
	await reloadExtensions();
	return registryStatus();
}

let bootstrap: Promise<void> | undefined;

/**
 * Clones and builds the registry the first time it is needed. Concurrent
 * callers share one attempt; a failed attempt is not cached, so the next call
 * tries again rather than leaving the catalog permanently empty.
 */
function ensureClone(): Promise<void> {
	bootstrap ??= cloneOnce().finally(() => {
		bootstrap = undefined;
	});
	return bootstrap;
}

async function cloneOnce(): Promise<void> {
	const clone = registryCloneDir();
	if (await registryCloneExists(clone)) return;
	await ensureRegistryHome();
	try {
		// A half-written clone from an interrupted attempt would make git refuse
		// to write into the directory at all.
		await removeRegistryClone(clone);
		await cloneRegistry(registryUrl, clone);
		const manifest = await readRegistryManifest(clone);
		if (manifest.build) await buildRegistry(manifest.build, clone);
	} catch (error) {
		await removeRegistryClone(clone);
		throw new Error(
			`Could not install the extension registry from ${registryUrl}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
	const installed = await readInstalledState();
	await writeInstalledState({
		...installed,
		...commitField(await registryCommit(clone)),
	});
}

function commitField(commit: string | undefined) {
	return commit ? { commit } : {};
}
