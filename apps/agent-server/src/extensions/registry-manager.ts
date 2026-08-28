import { execFile } from 'node:child_process';
import {
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { piAgentDir } from '../resources/pi-global-resources';
import type { RegistryStatus } from '@gizmo/protocol';

/**
 * The extension registry: git repos the user adds, which are cloned into a
 * source home and built locally; installing is linking an extension into the
 * global Pi extensions directory. Gizmo knows nothing about what an
 * extension does — it reads each registry's `gizmo.registry.json` and moves
 * files.
 *
 * Registry repo convention (see gizmo.registry.json at this repo's root):
 *   <extensionsDir>/<id>/pi-extension.ts   ← the tool (linked as <id>.ts)
 *   <extensionsDir>/<id>.web.js            ← optional built UI bundle
 *   gizmo.registry.json                    ← extensionsDir + catalog metadata
 */

const cloneHome = () => join(piAgentDir(), 'extensions-src');
const extensionsDir = () => join(piAgentDir(), 'extensions');
const manifestFile = () => join(cloneHome(), 'installed.json');

interface LinkedExtension {
	entry: string;
	web?: string;
}

interface RegistryRecord {
	name: string;
	url: string;
	commit?: string;
	addedAt: number;
	/** Extension ids linked into the Pi extensions directory. */
	linked: string[];
}

interface RegistryManifest {
	extensionsDir?: string;
	extensions?: { id: string; name?: string; description?: string }[];
	build?: string;
}

function exec(command: string, args: string[], cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(command, args, { cwd, windowsHide: true }, (error, stdout) => {
			if (error) reject(new Error(String(error.message)));
			else resolve(String(stdout));
		});
	});
}

function runBuild(command: string, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile(
			command,
			{ cwd, shell: true, windowsHide: true },
			(error, stdout, stderr) => {
				if (error) {
					reject(
						new Error(
							[error.message, stdout, stderr].filter(Boolean).join('\n'),
						),
					);
				} else resolve();
			},
		);
	});
}

function cloneName(url: string): string {
	const stem = url
		.replaceAll('\\', '/')
		.replace(/\.git$/, '')
		.split('/')
		.pop()!
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-');
	return stem || 'registry';
}

interface InstalledRegistry extends RegistryRecord {
	extensions: RegistryStatus['registries'][number]['extensions'];
}

async function readManifest(): Promise<InstalledRegistry[]> {
	try {
		const parsed = JSON.parse(await readFile(manifestFile(), 'utf8')) as {
			registries?: InstalledRegistry[];
		} | null;
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

async function writeManifest(registries: InstalledRegistry[]): Promise<void> {
	await mkdir(cloneHome(), { recursive: true });
	const temporary = `${manifestFile()}.tmp`;
	await writeFile(temporary, `${JSON.stringify({ registries }, null, 2)}\n`);
	await rename(temporary, manifestFile());
}

async function gitCommit(clone: string): Promise<string | undefined> {
	try {
		return (await exec('git', ['rev-parse', '--short', 'HEAD'], clone)).trim();
	} catch {
		return undefined;
	}
}

async function readRegistryManifest(clone: string): Promise<RegistryManifest> {
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

function registryDir(clone: string, manifest: RegistryManifest): string {
	return join(clone, manifest.extensionsDir ?? 'extensions');
}

async function syncExtension(
	clone: string,
	manifest: RegistryManifest,
	id: string,
): Promise<LinkedExtension> {
	const dir = join(registryDir(clone, manifest), id);
	const entrySource = join(dir, 'pi-extension.ts');
	await readFile(entrySource); // throws with a clear ENOENT when absent
	const entry = join(extensionsDir(), `${id}.ts`);
	const web = join(extensionsDir(), `${id}.web.js`);
	await Promise.all([rm(entry, { force: true }), rm(web, { force: true })]);
	await symlink(entrySource, entry, 'file');

	const webSource = join(registryDir(clone, manifest), `${id}.web.js`);
	const hasWeb = await readFile(webSource)
		.then(() => true)
		.catch(() => false);
	if (!hasWeb) return { entry };
	await symlink(webSource, web, 'file');
	return { entry, web };
}

function unlinkExtension(id: string): Promise<void> {
	return Promise.all([
		rm(join(extensionsDir(), `${id}.ts`), { force: true }),
		rm(join(extensionsDir(), `${id}.web.js`), { force: true }),
	]).then(() => undefined);
}

/** Builds the catalog for one registry: available extensions + link state. */
async function catalogFor(
	registry: InstalledRegistry,
): Promise<RegistryStatus['registries'][number]['extensions']> {
	const clone = join(cloneHome(), registry.name);
	const manifest = await readRegistryManifest(clone);
	const dir = registryDir(clone, manifest);
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
			extensionEntry = join(extensionsDir(), `${id}.ts`);
			web = join(extensionsDir(), `${id}.web.js`);
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

async function refreshLinked(registry: InstalledRegistry): Promise<void> {
	const clone = join(cloneHome(), registry.name);
	const manifest = await readRegistryManifest(clone);
	for (const id of registry.linked) {
		try {
			await syncExtension(clone, manifest, id);
		} catch (error) {
			console.error(`Could not sync extension "${id}":`, error);
		}
	}
}

export async function registryStatus(): Promise<RegistryStatus> {
	const registries = await readManifest();
	return {
		home: cloneHome(),
		registries: await Promise.all(
			registries.map(async (registry) => ({
				name: registry.name,
				url: registry.url,
				...(registry.commit ? { commit: registry.commit } : {}),
				addedAt: registry.addedAt,
				extensions: await catalogFor(registry),
			})),
		),
	};
}

export async function registryAdd(url: string): Promise<RegistryStatus> {
	const name = cloneName(url);
	const clone = join(cloneHome(), name);
	if (
		await readFile(join(clone, 'gizmo.registry.json'), 'utf8')
			.then(() => true)
			.catch(() => false)
	) {
		throw new Error(`A registry named "${name}" already exists`);
	}

	await mkdir(cloneHome(), { recursive: true });
	const cloneArgs = ['clone', '--depth', '1', url, clone];
	try {
		// cwd must exist at spawn time — git creates the target itself.
		await exec('git', cloneArgs, cloneHome());
		const manifest = await readRegistryManifest(clone);
		if (manifest.build) await runBuild(manifest.build, clone);
	} catch (error) {
		await rm(clone, { recursive: true, force: true });
		throw error;
	}

	const registries = await readManifest();
	registries.push({
		name,
		url,
		commit: await gitCommit(clone),
		addedAt: Date.now(),
		linked: [],
		extensions: [],
	});
	await writeManifest(registries);
	return registryStatus();
}

export async function registryUpdate(name: string): Promise<RegistryStatus> {
	const registries = await readManifest();
	const registry = registries.find((candidate) => candidate.name === name);
	if (!registry) throw new Error(`Registry "${name}" does not exist`);
	const clone = join(cloneHome(), name);
	await exec('git', ['pull', '--ff-only'], clone);
	const manifest = await readRegistryManifest(clone);
	if (manifest.build) await runBuild(manifest.build, clone);
	registry.commit = await gitCommit(clone);
	await refreshLinked(registry);
	await writeManifest(registries);
	return registryStatus();
}

export async function registryRemove(name: string): Promise<RegistryStatus> {
	const registries = await readManifest();
	const registry = registries.find((candidate) => candidate.name === name);
	if (!registry) throw new Error(`Registry "${name}" does not exist`);
	for (const id of registry.linked) await unlinkExtension(id);
	await rm(join(cloneHome(), name), { recursive: true, force: true });
	await writeManifest(
		registries.filter((candidate) => candidate.name !== name),
	);
	return registryStatus();
}

export async function registryLink(
	name: string,
	id: string,
): Promise<RegistryStatus> {
	const registries = await readManifest();
	const registry = registries.find((candidate) => candidate.name === name);
	if (!registry) throw new Error(`Registry "${name}" does not exist`);
	if (!registry.linked.includes(id)) registry.linked.push(id);
	const clone = join(cloneHome(), name);
	const manifest = await readRegistryManifest(clone);
	await syncExtension(clone, manifest, id);
	await writeManifest(registries);
	return registryStatus();
}

export async function registryUnlink(
	name: string,
	id: string,
): Promise<RegistryStatus> {
	const registries = await readManifest();
	const registry = registries.find((candidate) => candidate.name === name);
	if (!registry) throw new Error(`Registry "${name}" does not exist`);
	registry.linked = registry.linked.filter((linked) => linked !== id);
	await unlinkExtension(id);
	await writeManifest(registries);
	return registryStatus();
}
