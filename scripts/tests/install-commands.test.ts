import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the network and the service are stubbed. `releases-store` runs for
// real against a temporary data directory, so `current` is a genuine link
// and `currentVersion()` reads a genuine manifest.
vi.mock('../gizmo/release-download', async (importOriginal) => ({
	...(await importOriginal<typeof import('../gizmo/release-download')>()),
	latestReleaseTag: vi.fn(),
	fetchVerifiedTarball: vi.fn(),
	unpackTarball: vi.fn(),
}));
vi.mock('../gizmo/service', () => ({
	restartService: vi.fn(),
	waitUntilHealthy: vi.fn(async () => undefined),
}));

const { fetchVerifiedTarball, latestReleaseTag } =
	await import('../gizmo/release-download');
const { restartService, waitUntilHealthy } = await import('../gizmo/service');
const { installRelease, updateCommand } =
	await import('../gizmo/install-commands');
const { pointCurrent } = await import('../gizmo/releases-store');
const { releasesDir } = await import('../gizmo/paths');

const original = process.env.GIZMO_DATA_DIR;
let data: string;
let live: string;

beforeEach(async () => {
	vi.clearAllMocks();
	data = await mkdtemp(join(tmpdir(), 'gizmo-install-'));
	process.env.GIZMO_DATA_DIR = data;
	// A release install's `appRoot` is the release `current` points at, so
	// the live release doubles as the root passed to `updateCommand`.
	live = join(releasesDir(), 'v0.1.8');
	await mkdir(live, { recursive: true });
	await writeFile(
		join(live, 'RELEASE.json'),
		JSON.stringify({
			version: 'v0.1.8',
			commit: 'abc',
			extensionApiVersion: 1,
			registryRef: 'v1',
		}),
	);
	await pointCurrent(live);
});

/** What `gizmo run` writes: the release actually behind the ports. */
async function recordRunning(version: string, pid = process.pid) {
	await writeFile(
		join(data, 'running.json'),
		JSON.stringify({
			pid,
			version,
			root: live,
			startedAt: new Date().toISOString(),
		}),
	);
}

afterEach(async () => {
	process.env.GIZMO_DATA_DIR = original;
	await rm(data, { recursive: true, force: true });
});

describe('update on an install that is already current', () => {
	it('does nothing when the latest release is the one running', async () => {
		await recordRunning('v0.1.8');
		vi.mocked(latestReleaseTag).mockResolvedValue('v0.1.8');
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			await updateCommand(undefined, { root: live });
			expect(log.mock.calls.flat().join(' ')).toContain('Already on v0.1.8');
		} finally {
			log.mockRestore();
		}
		expect(fetchVerifiedTarball).not.toHaveBeenCalled();
		expect(restartService).not.toHaveBeenCalled();
	});

	it('does not ask GitHub when the named version is the one running', async () => {
		await recordRunning('v0.1.8');
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			await updateCommand('v0.1.8', { root: live });
		} finally {
			log.mockRestore();
		}
		expect(latestReleaseTag).not.toHaveBeenCalled();
		expect(fetchVerifiedTarball).not.toHaveBeenCalled();
		expect(restartService).not.toHaveBeenCalled();
	});
});

/*
 * `current` moves before the restart, so a restart that failed leaves the
 * link on the new release with the old one still serving. Trusting the link
 * alone made every later `update` a no-op, and the machine stayed on the old
 * release until someone noticed the browser was stale.
 */
describe('update when current is ahead of the running server', () => {
	it('restarts without downloading when an older release is serving', async () => {
		await recordRunning('v0.1.7');
		vi.mocked(latestReleaseTag).mockResolvedValue('v0.1.8');
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			await updateCommand(undefined, { root: live });
			expect(log.mock.calls.flat().join(' ')).toContain('v0.1.7 is still');
		} finally {
			log.mockRestore();
		}
		expect(fetchVerifiedTarball).not.toHaveBeenCalled();
		expect(restartService).toHaveBeenCalled();
		expect(waitUntilHealthy).toHaveBeenCalledWith('v0.1.8');
	});

	it('restarts when no server has recorded itself at all', async () => {
		vi.mocked(latestReleaseTag).mockResolvedValue('v0.1.8');
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			await updateCommand(undefined, { root: live });
		} finally {
			log.mockRestore();
		}
		expect(restartService).toHaveBeenCalled();
	});

	it('ignores a record whose process is gone', async () => {
		// A pid that exited: its record says v0.1.8, but nothing is serving it.
		const dead = await import('node:child_process');
		const child = dead.spawnSync(process.execPath, ['-e', '']);
		await recordRunning('v0.1.8', (child.pid ?? 0) + 1_000_000);
		vi.mocked(latestReleaseTag).mockResolvedValue('v0.1.8');
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			await updateCommand(undefined, { root: live });
		} finally {
			log.mockRestore();
		}
		expect(restartService).toHaveBeenCalled();
	});
});

describe('installing over the live release', () => {
	it('refuses rather than deleting the directory the server is using', async () => {
		await expect(installRelease('v0.1.8')).rejects.toThrow(/currently running/);
		expect(fetchVerifiedTarball).not.toHaveBeenCalled();
	});

	it('still installs a version that is not the one running', async () => {
		vi.mocked(fetchVerifiedTarball).mockRejectedValue(
			new Error('reached the download'),
		);
		await expect(installRelease('v0.1.9')).rejects.toThrow(
			'reached the download',
		);
		expect(fetchVerifiedTarball).toHaveBeenCalledWith('v0.1.9');
	});
});
