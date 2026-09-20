import {
	lstat,
	mkdir,
	readdir,
	readlink,
	rm,
	rmdir,
	symlink,
	unlink,
} from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
	appHome,
	currentLink,
	releaseManifestFile,
	releasesDir,
} from './paths';
import { compareVersions, readReleaseManifest } from './release-download';

/** Releases kept on disk, newest last. One older release is the rollback target. */
export async function installedReleases(): Promise<string[]> {
	try {
		const entries = await readdir(releasesDir(), { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort(compareVersions);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
}

async function removeLink(path: string) {
	try {
		await lstat(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
		throw error;
	}
	// A Windows junction is a directory reparse point: `unlink` refuses it and
	// `rmdir` removes the link without touching the target.
	await unlink(path).catch(() => rmdir(path));
}

/** Where `current` points, or `null` when nothing is installed. */
export async function currentTarget(): Promise<string | null> {
	try {
		return await readlink(currentLink());
	} catch {
		return null;
	}
}

export async function pointCurrent(target: string) {
	await mkdir(appHome(), { recursive: true });
	await removeLink(currentLink());
	await symlink(
		target,
		currentLink(),
		process.platform === 'win32' ? 'junction' : 'dir',
	);
}

export async function currentVersion(): Promise<string | null> {
	const target = await currentTarget();
	if (!target) return null;
	const manifest = await readReleaseManifest(releaseManifestFile(target));
	// A `source` install has no manifest; the directory name is the version
	// for every release this CLI unpacked itself.
	return manifest?.version ?? basename(target);
}

/** Keeps `keep` newest releases plus whatever `current` points at. */
export async function pruneReleases(keep = 2) {
	const releases = await installedReleases();
	const live = await currentTarget();
	const doomed = releases
		.slice(0, Math.max(0, releases.length - keep))
		.map((version) => join(releasesDir(), version))
		.filter((path) => path !== live);
	for (const path of doomed) await rm(path, { recursive: true, force: true });
	return doomed;
}

/** The release below the running one: what `gizmo rollback` goes back to. */
export async function previousRelease(): Promise<string | null> {
	const releases = await installedReleases();
	const live = await currentVersion();
	const index = live ? releases.indexOf(live) : releases.length;
	return index > 0 ? releases[index - 1] : (releases.at(-2) ?? null);
}
