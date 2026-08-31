import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RegistryStatus } from '@gizmo/protocol';
import { piAgentDir } from '../resources/pi-global-resources';
import { defaultDataDir } from '../sessions/session-repository';

export interface InstalledRegistry {
	name: string;
	url: string;
	commit?: string;
	addedAt: number;
	/** Extension ids linked into the Pi extensions directory. */
	linked: string[];
	extensions: RegistryStatus['registries'][number]['extensions'];
}

export interface RegistryManifest {
	extensionsDir?: string;
	extensions?: { id: string; name?: string; description?: string }[];
	build?: string;
}

/** Registry source is Gizmo-managed state, never part of Pi discovery. */
export const registryHome = () => join(defaultDataDir(), 'registries');
export const registryCloneDir = (name: string) => join(registryHome(), name);
export const extensionsDir = () => join(piAgentDir(), 'extensions');
export const extensionWebDir = () => join(piAgentDir(), 'extension-web');

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

export async function readInstalledRegistries(): Promise<InstalledRegistry[]> {
	try {
		const parsed = JSON.parse(
			await readFile(installedManifestFile(), 'utf8'),
		) as { registries?: InstalledRegistry[] } | null;
		return Array.isArray(parsed?.registries)
			? parsed.registries.map((registry) => ({
					...registry,
					linked: registry.linked ?? [],
					extensions: registry.extensions ?? [],
				}))
			: [];
	} catch {
		return [];
	}
}

export async function writeInstalledRegistries(
	registries: InstalledRegistry[],
): Promise<void> {
	await ensureRegistryHome();
	const temporary = `${installedManifestFile()}.tmp`;
	await writeFile(temporary, `${JSON.stringify({ registries }, null, 2)}\n`);
	await rename(temporary, installedManifestFile());
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
			...(parsed.build ? { build: parsed.build } : {}),
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
