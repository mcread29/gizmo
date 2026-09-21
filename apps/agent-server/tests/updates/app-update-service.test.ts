import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import type { AppUpdateStatus } from '@gizmo/protocol';
import { AppUpdateService } from '../../src/updates/app-update-service';
import { compareVersions } from '../../src/updates/app-update-source';

class FakeChild extends EventEmitter {
	stdout = new EventEmitter();
	stderr = new EventEmitter();
}

function service(
	overrides: Partial<ConstructorParameters<typeof AppUpdateService>[0]> = {},
) {
	const spawned: { args: string[]; child: FakeChild }[] = [];
	const broadcasts: AppUpdateStatus[] = [];
	const restart = vi.fn();
	const updates = new AppUpdateService({
		root: '/app/releases/v0.1.7',
		describe: async () => ({ kind: 'release', version: 'v0.1.7' }),
		latest: async () => ({ version: 'v0.1.8' }),
		spawnCli: ((_exe: string, args: string[]) => {
			const child = new FakeChild();
			spawned.push({ args, child });
			return child as unknown as ChildProcess;
		}) as unknown as typeof import('node:child_process').spawn,
		restartDelayMs: 0,
		...overrides,
	});
	updates.configure({
		broadcast: (status) => broadcasts.push(status),
		restart,
	});
	return { updates, spawned, broadcasts, restart };
}

describe('compareVersions', () => {
	it('orders tags numerically', () => {
		expect(compareVersions('v0.1.10', 'v0.1.9')).toBeGreaterThan(0);
		expect(compareVersions('v0.1.7', 'v0.1.7')).toBe(0);
	});
});

describe('AppUpdateService', () => {
	it('reports a newer release as available', async () => {
		const { updates } = service();
		const status = await updates.status();
		expect(status).toMatchObject({
			install: 'release',
			version: 'v0.1.7',
			latest: 'v0.1.8',
			updateAvailable: true,
			phase: 'idle',
		});
	});

	it('keeps the running version when the check fails', async () => {
		const { updates } = service({
			latest: async () => {
				throw new Error('offline');
			},
		});
		const status = await updates.status();
		expect(status.version).toBe('v0.1.7');
		expect(status.updateAvailable).toBe(false);
		expect(status.checkError).toBe('offline');
	});

	it('reuses a recent check unless asked to refresh', async () => {
		const latest = vi.fn(async () => ({ version: 'v0.1.8' }));
		const { updates } = service({ latest });
		await updates.status();
		await updates.status();
		expect(latest).toHaveBeenCalledTimes(1);
		await updates.status(true);
		expect(latest).toHaveBeenCalledTimes(2);
	});

	it('compares a checkout by commit, not by tag', async () => {
		const { updates } = service({
			describe: async () => ({
				kind: 'source',
				version: 'abc1234',
				commit: 'abc1234ffff',
			}),
			latest: async () => ({ version: 'def5678', commit: 'def5678ffff' }),
		});
		expect((await updates.status()).updateAvailable).toBe(true);
	});

	it('runs the CLI without a restart and exits once it succeeds', async () => {
		const { updates, spawned, broadcasts, restart } = service();
		await updates.status();
		const started = await updates.start();
		expect(started.phase).toBe('installing');
		expect(started.target).toBe('v0.1.8');
		expect(spawned[0]?.args.slice(-2)).toEqual(['update', '--no-restart']);

		spawned[0]!.child.stdout.emit('data', 'Installing v0.1.8\n');
		expect(broadcasts.at(-1)?.message).toBe('Installing v0.1.8');
		spawned[0]!.child.emit('exit', 0);
		expect(broadcasts.at(-1)?.phase).toBe('restarting');
		await new Promise((resolve) => setTimeout(resolve, 5));
		expect(restart).toHaveBeenCalledTimes(1);
	});

	it('keeps serving and reports the tail when the CLI fails', async () => {
		const { updates, spawned, broadcasts, restart } = service();
		await updates.start('v0.2.0');
		expect(spawned[0]?.args.at(-1)).toBe('v0.2.0');
		spawned[0]!.child.stderr.emit(
			'data',
			'GET tarball failed with HTTP 404.\n',
		);
		spawned[0]!.child.emit('exit', 1);
		const last = broadcasts.at(-1);
		expect(last?.phase).toBe('failed');
		expect(last?.message).toContain('HTTP 404');
		expect(restart).not.toHaveBeenCalled();
		// A failed update can be tried again.
		await expect(updates.start()).resolves.toMatchObject({
			phase: 'installing',
		});
	});

	it('refuses a second update while one is under way', async () => {
		const { updates } = service();
		await updates.start();
		await expect(updates.start()).rejects.toThrow('already under way');
	});
});
