import type { RegistryStatus } from '@gizmo/protocol';
import { reloadExtensions } from './extension-reload';
import { registryCatalog } from './registry-catalog';
import { extensionApiVersion } from '@gizmo/extension-api';
import {
	cloneRegistry,
	installRegistryDependencies,
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
	registryRef,
	registryUrl,
	removeRegistryClone,
	writeInstalledState,
	type RegistryManifest,
} from './registry-storage';

/**
 * Gizmo installs extensions from exactly one registry: its own `gizmo-registry`
 * repository's `${registryRef}` branch, cloned into Gizmo-managed storage. Linking exposes a
 * registry extension to Pi as a symlink; nothing is built.
 */
export async function registryStatus(): Promise<RegistryStatus> {
	await ensureClone();
	const clone = registryCloneDir();
	const installed = await readInstalledState();
	const [extensions, updateAvailable] = await Promise.all([
		registryCatalog(installed.linked),
		registryUpdateAvailable(clone, registryRef),
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
	await pullRegistry(clone, registryRef, requireCompatible);
	requireCompatible(await readRegistryManifest(clone));
	await installRegistryDependencies(clone);
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

/**
 * Removes everything the registry installed: every link, enabled or
 * disabled, then the clone and the remembered state. Hand-written
 * extensions are the user's own files and are never touched.
 */
export async function registryReset(): Promise<RegistryStatus> {
	const installed = await readInstalledState();
	for (const id of installed.linked) await unlinkExtension(id);
	await removeRegistryClone(registryCloneDir());
	await writeInstalledState({ linked: [] });
	await reloadExtensions();
	return { home: registryCloneDir(), url: registryUrl, extensions: [] };
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
 * Clones and installs the registry the first time it is needed. Concurrent
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
	if (await registryCloneExists(clone)) {
		requireCompatible(await readRegistryManifest(clone));
		return;
	}
	await ensureRegistryHome();
	try {
		// A half-written clone from an interrupted attempt would make git refuse
		// to write into the directory at all.
		await removeRegistryClone(clone);
		await cloneRegistry(registryUrl, clone, registryRef);
		requireCompatible(await readRegistryManifest(clone));
		await installRegistryDependencies(clone);
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

/** A registry declaring another API major is refused before it is used. */
function requireCompatible(manifest: RegistryManifest): void {
	const declared = manifest.gizmoApiVersion;
	if (declared !== undefined && declared !== extensionApiVersion) {
		throw new Error(
			`Registry is written for extension API ${declared}; this Gizmo supports ${extensionApiVersion}`,
		);
	}
}

function commitField(commit: string | undefined) {
	return commit ? { commit } : {};
}
