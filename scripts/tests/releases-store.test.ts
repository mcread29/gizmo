import {
	chmod,
	mkdir,
	mkdtemp,
	readdir,
	rm,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { currentLink, releasesDir, serviceRoot } from '../gizmo/paths';
import {
	currentVersion,
	installedReleases,
	pointCurrent,
	previousRelease,
	pruneReleases,
} from '../gizmo/releases-store';

const original = process.env.GIZMO_DATA_DIR;
let data: string;

beforeEach(async () => {
	data = await mkdtemp(join(tmpdir(), 'gizmo-store-'));
	process.env.GIZMO_DATA_DIR = data;
});

afterEach(async () => {
	process.env.GIZMO_DATA_DIR = original;
	await rm(data, { recursive: true, force: true });
});

async function release(version: string, manifest = true) {
	const path = join(releasesDir(), version);
	await mkdir(path, { recursive: true });
	if (manifest) {
		await writeFile(
			join(path, 'RELEASE.json'),
			JSON.stringify({
				version,
				commit: 'abc',
				extensionApiVersion: 1,
				registryRef: 'v1',
			}),
			'utf8',
		);
	}
	return path;
}

describe('installedReleases', () => {
	it('is empty before anything is installed', async () => {
		expect(await installedReleases()).toEqual([]);
	});

	it('orders by version, not by name', async () => {
		await release('v0.10.0');
		await release('v0.9.0');
		await release('v0.2.0');
		expect(await installedReleases()).toEqual(['v0.2.0', 'v0.9.0', 'v0.10.0']);
	});
});

describe('currentVersion', () => {
	it('is null until current points somewhere', async () => {
		expect(await currentVersion()).toBeNull();
	});

	it('reads the manifest of whatever current points at', async () => {
		await pointCurrent(await release('v0.2.0'));
		expect(await currentVersion()).toBe('v0.2.0');
	});

	it('falls back to the directory name without a manifest', async () => {
		await pointCurrent(await release('v0.3.0', false));
		expect(await currentVersion()).toBe('v0.3.0');
	});

	it('re-points an existing link rather than failing on it', async () => {
		await pointCurrent(await release('v0.1.0'));
		await pointCurrent(await release('v0.2.0'));
		expect(await currentVersion()).toBe('v0.2.0');
	});
});

describe('pruneReleases', () => {
	it('keeps the newest two', async () => {
		for (const version of ['v0.1.0', 'v0.2.0', 'v0.3.0', 'v0.4.0']) {
			await release(version);
		}
		await pointCurrent(join(releasesDir(), 'v0.4.0'));

		await pruneReleases();

		expect(await installedReleases()).toEqual(['v0.3.0', 'v0.4.0']);
	});

	it('never deletes the release that is running', async () => {
		for (const version of ['v0.1.0', 'v0.2.0', 'v0.3.0']) {
			await release(version);
		}
		// Pinned to the oldest, which is otherwise exactly what prune removes.
		await pointCurrent(join(releasesDir(), 'v0.1.0'));

		await pruneReleases();

		const kept = (await readdir(releasesDir())).sort();
		expect(kept).toContain('v0.1.0');
		expect(await currentVersion()).toBe('v0.1.0');
	});

	// Windows keeps the just-stopped release locked for a moment; the other
	// stale releases still have to go, and the locked one is reported.
	it.skipIf(process.platform === 'win32')(
		'reports a locked release without stranding the rest',
		async () => {
			for (const version of ['v0.1.0', 'v0.2.0', 'v0.3.0', 'v0.4.0']) {
				await release(version);
			}
			await pointCurrent(join(releasesDir(), 'v0.4.0'));
			const locked = join(releasesDir(), 'v0.1.0');
			await chmod(locked, 0o500);

			try {
				const result = await pruneReleases();

				expect(result.removed).toEqual([join(releasesDir(), 'v0.2.0')]);
				expect(result.locked.map((entry) => entry.path)).toEqual([locked]);
				expect(await installedReleases()).toEqual([
					'v0.1.0',
					'v0.3.0',
					'v0.4.0',
				]);
			} finally {
				await chmod(locked, 0o700);
			}
		},
	);
});

describe('previousRelease', () => {
	it('is null with nothing to go back to', async () => {
		await pointCurrent(await release('v0.1.0'));
		expect(await previousRelease()).toBeNull();
	});

	it('names the release below the running one', async () => {
		await release('v0.1.0');
		await release('v0.2.0');
		await pointCurrent(await release('v0.3.0'));
		expect(await previousRelease()).toBe('v0.2.0');
	});
});

describe('serviceRoot', () => {
	it('points a release install at the current link so updates take effect', () => {
		const releases = join('/data', 'app', 'releases');
		expect(serviceRoot(join(releases, 'v0.1.1'), releases)).toBe(currentLink());
	});

	it('leaves a source checkout as its own root', () => {
		const releases = join('/data', 'app', 'releases');
		expect(serviceRoot('/work/gizmo', releases)).toBe('/work/gizmo');
		expect(serviceRoot(releases, releases)).toBe(releases);
	});
});
