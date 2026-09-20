import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The repository releases are published from. */
export const releaseRepository = 'mcread29/gizmo';

export const tarballName = (version: string) => `gizmo-${version}.tar.gz`;

export const assetUrl = (version: string, name: string) =>
	`https://github.com/${releaseRepository}/releases/download/${version}/${name}`;

/** `v1.2.3` sorts after `v1.2.2`; anything unparsable sorts first. */
export function compareVersions(left: string, right: string): number {
	const parse = (value: string) =>
		value
			.replace(/^v/, '')
			.split('.')
			.map((part) => Number.parseInt(part, 10) || 0);
	const [a, b] = [parse(left), parse(right)];
	for (let index = 0; index < 3; index += 1) {
		if ((a[index] ?? 0) !== (b[index] ?? 0))
			return (a[index] ?? 0) - (b[index] ?? 0);
	}
	return 0;
}

export async function latestReleaseTag(): Promise<string> {
	const response = await fetch(
		`https://api.github.com/repos/${releaseRepository}/releases/latest`,
		{ headers: { accept: 'application/vnd.github+json' } },
	);
	if (!response.ok) {
		throw new Error(
			`Could not ask GitHub for the latest release (HTTP ${String(response.status)}).`,
		);
	}
	const release = (await response.json()) as { tag_name?: string };
	if (!release.tag_name) throw new Error('The latest release has no tag.');
	return release.tag_name;
}

/** Maps `SHA256SUMS` to `{ filename: digest }`. */
export function parseChecksums(contents: string): Map<string, string> {
	const entries = new Map<string, string>();
	for (const line of contents.split(/\r?\n/)) {
		const match = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim());
		if (match) entries.set(match[2], match[1].toLowerCase());
	}
	return entries;
}

export const sha256 = (data: Uint8Array) =>
	createHash('sha256').update(data).digest('hex');

async function download(url: string): Promise<Buffer> {
	const response = await fetch(url, { redirect: 'follow' });
	if (!response.ok) {
		throw new Error(`GET ${url} failed with HTTP ${String(response.status)}.`);
	}
	return Buffer.from(await response.arrayBuffer());
}

/**
 * Downloads the tarball and refuses to unpack one whose digest is not the
 * published one, so a truncated or substituted asset never becomes a release
 * directory.
 */
export async function fetchVerifiedTarball(version: string): Promise<string> {
	const name = tarballName(version);
	const [archive, sums] = await Promise.all([
		download(assetUrl(version, name)),
		download(assetUrl(version, 'SHA256SUMS')).then((buffer) =>
			buffer.toString('utf8'),
		),
	]);
	const expected = parseChecksums(sums).get(name);
	if (!expected)
		throw new Error(`SHA256SUMS for ${version} does not list ${name}.`);
	const actual = sha256(archive);
	if (actual !== expected) {
		throw new Error(`${name} has digest ${actual}, expected ${expected}.`);
	}
	const staging = join(tmpdir(), `gizmo-${version}-${String(process.pid)}`);
	await mkdir(staging, { recursive: true });
	const file = join(staging, name);
	await writeFile(file, archive);
	return file;
}

/**
 * Which `tar` to run. Windows 10+ ships bsdtar in System32, but a Git for
 * Windows install often puts GNU tar ahead of it on PATH, and GNU tar reads
 * `C:\\...` as `host:path` ("Cannot connect to C: resolve failed"). Prefer the
 * system copy whenever it exists.
 */
export function tarExecutable(
	platform = process.platform,
	env = process.env,
	exists: (path: string) => boolean = existsSync,
): string {
	if (platform !== 'win32') return 'tar';
	const system = join(env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
	return exists(system) ? system : 'tar';
}

/** `tar` ships with Windows 10+ as well, so one extractor covers all three. */
export async function unpackTarball(archive: string, target: string) {
	await rm(target, { recursive: true, force: true });
	await mkdir(target, { recursive: true });
	const result = spawnSync(tarExecutable(), ['-xzf', archive, '-C', target], {
		encoding: 'utf8',
		windowsHide: true,
	});
	if (result.status !== 0) {
		await rm(target, { recursive: true, force: true });
		throw new Error(`tar could not unpack ${archive}: ${result.stderr ?? ''}`);
	}
}

export interface ReleaseManifest {
	version: string;
	commit: string;
	extensionApiVersion: number;
	registryRef: string;
}

export async function readReleaseManifest(
	file: string,
): Promise<ReleaseManifest | null> {
	try {
		return JSON.parse(await readFile(file, 'utf8')) as ReleaseManifest;
	} catch {
		return null;
	}
}
