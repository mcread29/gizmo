import {
	cp,
	lstat,
	mkdir,
	readdir,
	realpath,
	rename,
	rm,
	stat,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, sep } from 'node:path';
import { defaultDataDir } from '../sessions/session-repository';
import { syncExtension } from './registry-links';
import {
	disabledExtensionsDir,
	extensionsDir,
	readInstalledState,
	readRegistryManifest,
	registryCloneDir,
} from './registry-storage';

/**
 * One-time move of the link farm out of Pi's home directory. Registry
 * extensions linked under the old `~/.pi/agent/extensions{,-disabled}` are
 * re-linked into Gizmo's own directories (keeping their enabled side) and the
 * old links removed; anything else there is hand-written, so it is imported
 * as a real copy and the original left for the Pi CLI.
 *
 * Idempotent: entries already present in the new directories are never
 * overwritten, so re-runs only fill in what is still missing.
 */
export async function migrateExtensionDirs(options?: {
	oldEnabled?: string;
	oldDisabled?: string;
}): Promise<void> {
	const { enabled: oldEnabled, disabled: oldDisabled } = {
		...legacyExtensionDirs(),
		...pickDefined(options),
	};
	await mkdir(extensionsDir(), { recursive: true });
	await mkdir(disabledExtensionsDir(), { recursive: true });
	const installed = await readInstalledState();
	const linked = new Set(installed.linked);
	await relinkRegistryExtensions(oldEnabled, oldDisabled, [...linked]);
	await importHandWritten(oldEnabled, oldDisabled, linked);
}

/** Where Gizmo used to link extensions, before it owned the directory. */
export function legacyExtensionDirs(): {
	enabled: string;
	disabled: string;
} {
	const home = homedir();
	const agentDir = process.env.PI_CODING_AGENT_DIR
		? process.env.PI_CODING_AGENT_DIR.replace(/^~(?=$|[\\/])/, home)
		: join(home, '.pi', 'agent');
	return {
		enabled: join(agentDir, 'extensions'),
		disabled: join(agentDir, 'extensions-disabled'),
	};
}

async function relinkRegistryExtensions(
	oldEnabled: string,
	oldDisabled: string,
	linked: string[],
): Promise<void> {
	if (!linked.length) return;
	const clone = registryCloneDir();
	const manifest = await readRegistryManifest(clone);
	if (!(await exists(clone))) return;
	for (const id of linked) {
		try {
			if (
				(await exists(join(extensionsDir(), id))) ||
				(await exists(join(disabledExtensionsDir(), id)))
			) {
				continue;
			}
			const wasDisabled = await exists(join(oldDisabled, id));
			if (!(wasDisabled || (await exists(join(oldEnabled, id))))) {
				// Linked in state but missing on disk everywhere; the next
				// registry refresh re-creates it from the clone.
				continue;
			}
			await removeIfGizmoOwned(oldEnabled, id);
			await removeIfGizmoOwned(oldDisabled, id);
			await syncExtension(clone, manifest, id);
			if (wasDisabled) {
				await mkdir(disabledExtensionsDir(), { recursive: true });
				await rm(join(disabledExtensionsDir(), id), {
					recursive: true,
					force: true,
				});
				await rename(
					join(extensionsDir(), id),
					join(disabledExtensionsDir(), id),
				);
			}
		} catch (error) {
			console.warn(`Could not migrate registry extension "${id}":`, error);
		}
	}
}

async function importHandWritten(
	oldEnabled: string,
	oldDisabled: string,
	linked: Set<string>,
): Promise<void> {
	for (const [oldRoot, newRoot] of [
		[oldEnabled, extensionsDir()],
		[oldDisabled, disabledExtensionsDir()],
	] as const) {
		let entries;
		try {
			entries = await readdir(oldRoot, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.name.startsWith('.')) continue;
			if (linked.has(entry.name)) continue;
			if (
				(await exists(join(extensionsDir(), entry.name))) ||
				(await exists(join(disabledExtensionsDir(), entry.name)))
			) {
				continue;
			}
			// The old duplication bug could leave the same id on both sides;
			// the enabled copy wins and the disabled one stays untouched.
			if (
				newRoot === disabledExtensionsDir() &&
				(await exists(join(extensionsDir(), entry.name)))
			) {
				continue;
			}
			try {
				await cp(join(oldRoot, entry.name), join(newRoot, entry.name), {
					recursive: true,
					dereference: true,
				});
			} catch (error) {
				console.warn(
					`Could not import hand-written extension "${entry.name}":`,
					error,
				);
			}
		}
	}
}

/**
 * Removes an old entry only when Gizmo put it there: a link, or anything
 * resolving inside Gizmo's data directory (the registry clone lives there).
 * Hand-written files are never deleted; `~/.pi` belongs to the Pi CLI.
 */
async function removeIfGizmoOwned(root: string, id: string): Promise<void> {
	const path = join(root, id);
	let stats;
	try {
		stats = await lstat(path);
	} catch {
		return;
	}
	if (stats.isSymbolicLink()) {
		await rm(path, { recursive: true, force: true });
		return;
	}
	try {
		const target = await realpath(path);
		const prefix = `${defaultDataDir()}${sep}`;
		if (target === defaultDataDir() || target.startsWith(prefix)) {
			await rm(path, { recursive: true, force: true });
		}
	} catch {
		// Unresolvable entries are left alone rather than risk user files.
	}
}

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

function pickDefined(options?: { oldEnabled?: string; oldDisabled?: string }): {
	enabled?: string;
	disabled?: string;
} {
	return {
		...(options?.oldEnabled ? { enabled: options.oldEnabled } : {}),
		...(options?.oldDisabled ? { disabled: options.oldDisabled } : {}),
	};
}
