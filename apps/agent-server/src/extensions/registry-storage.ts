import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extensionApiVersion } from '@gizmo/extension-api';
import { defaultDataDir } from '../sessions/session-repository';

/** The one registry Gizmo installs extensions from. */
export const registryUrl = 'https://github.com/mcread29/gizmo-registry.git';
/**
 * The registry branch this build follows: one per extension API major, so
 * an app on API 1 never pulls an extension written against API 2.
 */
export const registryRef = `v${extensionApiVersion}`;

/** What Gizmo remembers about its clone between runs. */
export interface InstalledState {
	/** Extension ids linked into the Pi extensions directory. */
	linked: string[];
	commit?: string;
}

export interface RegistryManifest {
	extensionsDir?: string;
	extensions?: { id: string; name?: string; description?: string }[];
	/** The extension API major the registry's extensions are written for. */
	gizmoApiVersion?: number;
}

/** Registry source is Gizmo-managed state, never part of Pi discovery. */
export const registryHome = () => join(defaultDataDir(), 'registries');
export const registryCloneDir = () => join(registryHome(), 'gizmo-registry');
/**
 * The link farm Gizmo owns: registry extensions are linked here so Pi loads
 * them through explicit paths. `~/.pi` stays entirely with the Pi CLI.
 */
export const extensionsDir = () => join(defaultDataDir(), 'extensions');
export const disabledExtensionsDir = () =>
	join(defaultDataDir(), 'extensions-disabled');

const installedManifestFile = () => join(registryHome(), 'installed.json');

export function ensureRegistryHome() {
	return mkdir(registryHome(), { recursive: true }).then(() => undefined);
}

export function removeRegistryClone(clone: string) {
	return rm(clone, { recursive: true, force: true });
}

export async function registryCloneExists(clone: string) {
	return readFile(join(clone, 'gizmo.registry.json'), 'utf8')
		.then(() => true)
		.catch(() => false);
}

/**
 * Reads the persisted state, accepting the multi-registry file Gizmo used to
 * write so an existing install keeps the extensions it linked.
 */
export async function readInstalledState(): Promise<InstalledState> {
	try {
		const parsed = JSON.parse(
			await readFile(installedManifestFile(), 'utf8'),
		) as {
			linked?: unknown;
			commit?: unknown;
			registries?: { name?: string; linked?: unknown; commit?: unknown }[];
		} | null;
		if (Array.isArray(parsed?.registries)) {
			const legacy =
				parsed.registries.find(
					(registry) => registry.name === 'gizmo-registry',
				) ?? parsed.registries[0];
			return state(legacy?.linked, legacy?.commit);
		}
		return state(parsed?.linked, parsed?.commit);
	} catch {
		return { linked: [] };
	}
}

export async function writeInstalledState(
	installed: InstalledState,
): Promise<void> {
	await ensureRegistryHome();
	const temporary = `${installedManifestFile()}.tmp`;
	await writeFile(temporary, `${JSON.stringify(installed, null, 2)}\n`);
	await rename(temporary, installedManifestFile());
}

function state(linked: unknown, commit: unknown): InstalledState {
	return {
		linked: Array.isArray(linked)
			? linked.filter((id): id is string => typeof id === 'string')
			: [],
		...(typeof commit === 'string' ? { commit } : {}),
	};
}

export async function readRegistryManifest(
	clone: string,
): Promise<RegistryManifest> {
	try {
		const parsed = JSON.parse(
			await readFile(join(clone, 'gizmo.registry.json'), 'utf8'),
		) as RegistryManifest;
		return {
			...(parsed.extensionsDir ? { extensionsDir: parsed.extensionsDir } : {}),
			...(typeof parsed.gizmoApiVersion === 'number'
				? { gizmoApiVersion: parsed.gizmoApiVersion }
				: {}),
			...(Array.isArray(parsed.extensions)
				? { extensions: parsed.extensions }
				: {}),
		};
	} catch {
		return {};
	}
}

export function registryExtensionsDir(
	clone: string,
	manifest: RegistryManifest,
) {
	return join(clone, manifest.extensionsDir ?? 'extensions');
}
