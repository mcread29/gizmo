import { execFile } from 'node:child_process';
import {
	copyFile,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { piAgentDir } from '../resources/pi-global-resources';
import type { RegistryExtensionStatus, RegistryStatus } from '@gizmo/protocol';

/**
 * The extension registry: git repos the user clones into a source home,
 * builds locally (each repo declares its own build), and links into the
 * global Pi extensions directory. Gizmo knows nothing about what an
 * extension does — it moves files per each repo's `gizmo.registry.json`.
 *
 * Registry repo convention:
 *   extensions/<name>/pi-extension.ts   ← the tool (copied as <name>.ts)
 *   extensions/<name>.web.js            ← optional built UI bundle (built by
 *                                         the repo itself, e.g. via
 *                                         pi-extensions:build)
 *   gizmo.registry.json                 ← optional overrides:
 *                                         { extensionsDir, build }
 */

const cloneHome = () => join(piAgentDir(), 'extensions-src');
const extensionsDir = () => join(piAgentDir(), 'extensions');
const manifestFile = () => join(cloneHome(), 'installed.json');

interface InstalledRecord {
	name: string;
	url: string;
	commit?: string;
	installedAt: number;
	extensions: RegistryExtensionStatus['extensions'];
}

interface RegistryManifest {
	/** Where the registry keeps its extension directories. */
	extensionsDir?: string;
	/** Optional build command, run in the clone before syncing. */
	build?: string;
}

function runGit(command: string, args: string[], cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(command, args, { cwd, windowsHide: true }, (error, stdout) => {
			if (error) reject(new Error(String(error.message)));
			else resolve(String(stdout));
		});
	});
}

function runBuild(command: string, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile(command, { cwd, shell: true, windowsHide: true }, (error) => {
			if (error) reject(new Error(String(error.message)));
			else resolve();
		});
	});
}

function cloneName(url: string): string {
	const stem = url
		.replace(/\.git$/, '')
		.split('/')
		.pop()!
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-');
	return stem || 'registry';
}

async function readManifest(): Promise<InstalledRecord[]> {
	try {
		const parsed = JSON.parse(await readFile(manifestFile(), 'utf8')) as {
			installed?: InstalledRecord[];
		} | null;
		return Array.isArray(parsed?.installed)
			? parsed.installed.map((record) => ({
					...record,
					extensions: record.extensions ?? [],
				}))
			: [];
	} catch {
		return [];
	}
}

async function writeManifest(records: InstalledRecord[]): Promise<void> {
	await mkdir(cloneHome(), { recursive: true });
	const temporary = `${manifestFile()}.tmp`;
	await writeFile(
		temporary,
		`${JSON.stringify({ installed: records }, null, 2)}\n`,
	);
	await rename(temporary, manifestFile());
}

async function readRegistryManifest(clone: string): Promise<RegistryManifest> {
	try {
		const parsed = JSON.parse(
			await readFile(join(clone, 'gizmo.registry.json'), 'utf8'),
		) as RegistryManifest;
		return {
			...(parsed.extensionsDir ? { extensionsDir: parsed.extensionsDir } : {}),
			...(parsed.build ? { build: parsed.build } : {}),
		};
	} catch {
		return {};
	}
}

async function gitCommit(clone: string): Promise<string | undefined> {
	try {
		return (
			await runGit('git', ['rev-parse', '--short', 'HEAD'], clone)
		).trim();
	} catch {
		return undefined;
	}
}

/** Copies an extension pair from the clone into the loaded extensions dir. */
async function syncExtension(
	clone: string,
	manifest: RegistryManifest,
	name: string,
): Promise<RegistryExtensionStatus['extensions'][number]> {
	const dir = join(clone, manifest.extensionsDir ?? 'extensions', name);
	const entrySource = join(dir, 'pi-extension.ts');
	await readFile(entrySource); // throws with a clear ENOENT when absent
	const entry = join(extensionsDir(), `${name}.ts`);
	await copyFile(entrySource, entry);

	let web: string | undefined;
	const webSource = join(dir, `${name}.web.js`);
	try {
		await readFile(webSource);
		web = join(extensionsDir(), `${name}.web.js`);
		await copyFile(webSource, web);
	} catch {
		// No UI bundle built for this extension — tool only.
	}
	return { id: name, entry, ...(web ? { web } : {}) };
}

/** Re-syncs every extension of every installed registry clone. */
async function syncAll(records: InstalledRecord[]): Promise<void> {
	await mkdir(extensionsDir(), { recursive: true });
	for (const record of records) {
		const clone = join(cloneHome(), record.name);
		const manifest = await readRegistryManifest(clone);
		const dir = join(clone, manifest.extensionsDir ?? 'extensions');
		const extensions: RegistryExtensionStatus['extensions'] = [];
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			record.extensions = [];
			continue;
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			try {
				extensions.push(await syncExtension(clone, manifest, entry.name));
			} catch (error) {
				console.error(
					`Could not sync extension "${entry.name}" from ${record.name}:`,
					error,
				);
			}
		}
		record.extensions = extensions;
	}
	await writeManifest(records);
}

export async function registryStatus(): Promise<RegistryStatus> {
	return { home: cloneHome(), installed: await readManifest() };
}

export async function registryInstall(url: string): Promise<RegistryStatus> {
	const name = cloneName(url);
	const clone = join(cloneHome(), name);
	if (
		await readFile(join(clone, 'gizmo.registry.json'), 'utf8')
			.then(() => true)
			.catch(() => false)
	) {
		throw new Error(`"${name}" is already installed`);
	}

	await mkdir(cloneHome(), { recursive: true });
	const cloneArgs = ['clone', '--depth', '1', url, clone];
	await runGit('git', cloneArgs, clone);

	const manifest = await readRegistryManifest(clone);
	if (manifest.build) await runBuild(manifest.build, clone);

	const records = await readManifest();
	records.push({
		name,
		url,
		commit: await gitCommit(clone),
		installedAt: Date.now(),
		extensions: [],
	});
	await syncAll(records);
	return registryStatus();
}

export async function registryUpdate(name: string): Promise<RegistryStatus> {
	const records = await readManifest();
	const record = records.find((candidate) => candidate.name === name);
	if (!record) throw new Error(`"${name}" is not installed`);
	const clone = join(cloneHome(), name);
	await runGit('git', ['pull', '--ff-only'], clone);
	const manifest = await readRegistryManifest(clone);
	if (manifest.build) await runBuild(manifest.build, clone);
	record.commit = await gitCommit(clone);
	record.installedAt = Date.now();
	await syncAll(records);
	return registryStatus();
}

export async function registryRemove(name: string): Promise<RegistryStatus> {
	const records = await readManifest();
	if (!records.some((candidate) => candidate.name === name)) {
		throw new Error(`"${name}" is not installed`);
	}
	// Remove the loaded artifacts; the clone stays for reinstalls.
	await rm(join(extensionsDir(), `${name}.ts`), { force: true });
	await rm(join(extensionsDir(), `${name}.web.js`), { force: true });
	await writeManifest(records.filter((candidate) => candidate.name !== name));
	return registryStatus();
}
