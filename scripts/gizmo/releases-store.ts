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

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * Windows releases a stopped process's file handles a moment after it exits,
 * and the indexer or a virus scanner can hold a directory open for longer
 * than that, so the first `rm` after a restart often fails with `EBUSY` on a
 * release that is seconds away from being deletable. A few short retries
 * cover that window; anything still locked is left for the next update.
 */
async function removeRelease(path: string, attempts = 5) {
	for (let attempt = 1; ; attempt++) {
		try {
			await rm(path, { recursive: true, force: true });
			return;
		} catch (error) {
			if (attempt === attempts) throw error;
			await sleep(attempt * 200);
		}
	}
}

export type PruneResult = {
	removed: string[];
	locked: { path: string; message: string }[];
};

/**
 * Keeps `keep` newest releases plus whatever `current` points at. One locked
 * directory must not strand the others, so each is removed on its own and
 * failures are reported rather than thrown.
 */
export async function pruneReleases(keep = 2): Promise<PruneResult> {
	const releases = await installedReleases();
	const live = await currentTarget();
	const doomed = releases
		.slice(0, Math.max(0, releases.length - keep))
		.map((version) => join(releasesDir(), version))
		.filter((path) => path !== live);
	const result: PruneResult = { removed: [], locked: [] };
	for (const path of doomed) {
		try {
			await removeRelease(path);
			result.removed.push(path);
		} catch (error) {
			result.locked.push({ path, message: (error as Error).message });
		}
	}
	return result;
}

/** The release below the running one: what `gizmo rollback` goes back to. */
export async function previousRelease(): Promise<string | null> {
	const releases = await installedReleases();
	const live = await currentVersion();
	const index = live ? releases.indexOf(live) : releases.length;
	return index > 0 ? releases[index - 1] : (releases.at(-2) ?? null);
}
