import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	utimes,
	writeFile,
} from 'node:fs/promises';
import { tmpdir, uptime } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pointCurrent } from '../gizmo/releases-store';
import { recordRunningServer, runningServer } from '../gizmo/running';
import { expectedVersion } from '../gizmo/service';

const original = process.env.GIZMO_DATA_DIR;
let data: string;

beforeEach(async () => {
	data = await mkdtemp(join(tmpdir(), 'gizmo-running-'));
	process.env.GIZMO_DATA_DIR = data;
});

afterEach(async () => {
	process.env.GIZMO_DATA_DIR = original;
	await rm(data, { recursive: true, force: true });
});

/** A moment before this machine last booted. */
const beforeBoot = () => new Date(Date.now() - uptime() * 1000 - 3_600_000);

/** A record naming a live process that is not this one: the test runner's parent. */
async function recordOther(startedAt: Date) {
	await writeFile(
		join(data, 'running.json'),
		JSON.stringify({
			pid: process.ppid,
			version: 'v0.1.8',
			root: data,
			startedAt: startedAt.toISOString(),
		}),
	);
}

describe('the running-server record', () => {
	it('refuses to start behind a live server recorded since boot', async () => {
		await recordOther(new Date());
		await expect(recordRunningServer(data)).rejects.toThrow(/already running/);
	});

	it('ignores a record from before the last boot, whatever holds its pid', async () => {
		await recordOther(beforeBoot());
		expect(runningServer()).toBeNull();

		await recordRunningServer(data);

		const record = JSON.parse(
			await readFile(join(data, 'running.json'), 'utf8'),
		);
		expect(record.pid).toBe(process.pid);
	});

	it('ignores a pre-boot web.pid left by an older release', async () => {
		const pidFile = join(data, 'web.pid');
		await writeFile(pidFile, String(process.ppid));
		await utimes(pidFile, beforeBoot(), beforeBoot());

		await expect(recordRunningServer(data)).resolves.toBeUndefined();
	});

	it('expects a checkout to serve itself despite a leftover current link', async () => {
		const release = join(data, 'app', 'releases', 'v0.1.8');
		await mkdir(release, { recursive: true });
		await writeFile(
			join(release, 'RELEASE.json'),
			JSON.stringify({
				version: 'v0.1.8',
				commit: 'abc',
				extensionApiVersion: 1,
				registryRef: 'v1',
			}),
		);
		await pointCurrent(release);
		const checkout = await mkdtemp(join(tmpdir(), 'gizmo-checkout-'));

		expect(await expectedVersion(checkout)).toBe('source');
		expect(await expectedVersion(release)).toBe('v0.1.8');
		await rm(checkout, { recursive: true, force: true });
	});
});
