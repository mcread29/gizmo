import { EventEmitter } from 'node:events';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { startUntilListening } from '../lib/web-process';

/** A stand-in child: no pid, so stopping it is a no-op. */
function fakeChild(exitCode: number | null = null): ChildProcess {
	const child = new EventEmitter() as ChildProcess;
	Object.assign(child, { pid: undefined, exitCode });
	return child;
}

async function freePort() {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	await new Promise<void>((resolve) => server.close(() => resolve()));
	return port;
}

describe('startUntilListening', () => {
	const servers: Server[] = [];
	afterEach(async () => {
		for (const server of servers.splice(0)) {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});

	it('returns the child once the port accepts connections', async () => {
		const port = await freePort();
		const logFile = join(await mkdtemp(join(tmpdir(), 'gizmo-')), 'web.log');
		const server = createServer();
		servers.push(server);
		await new Promise<void>((resolve) =>
			server.listen(port, '127.0.0.1', resolve),
		);
		const child = fakeChild();
		const started = await startUntilListening(() => child, port, logFile, {
			timeoutMilliseconds: 2_000,
			attempts: 1,
		});
		expect(started).toBe(child);
	});

	it('retries a start that exits early and records each failure', async () => {
		const port = await freePort();
		const logFile = join(await mkdtemp(join(tmpdir(), 'gizmo-')), 'web.log');
		const server = createServer();
		servers.push(server);
		let attempt = 0;
		const spawnChild = () => {
			attempt += 1;
			if (attempt < 3) return fakeChild(1);
			server.listen(port, '127.0.0.1');
			return fakeChild();
		};
		await startUntilListening(spawnChild, port, logFile, {
			timeoutMilliseconds: 5_000,
			attempts: 3,
		});
		expect(attempt).toBe(3);
		const log = await readFile(logFile, 'utf8');
		expect(log).toContain('Start attempt 1 of 3 failed');
		expect(log).toContain('Start attempt 2 of 3 failed');
		expect(log).toContain('Trying again.');
	});

	it('gives up after the last attempt', async () => {
		const port = await freePort();
		const logFile = join(await mkdtemp(join(tmpdir(), 'gizmo-')), 'web.log');
		let attempt = 0;
		const spawnChild = () => {
			attempt += 1;
			return fakeChild(1);
		};
		await expect(
			startUntilListening(spawnChild, port, logFile, {
				timeoutMilliseconds: 1_000,
				attempts: 2,
			}),
		).rejects.toThrow('exited before listening');
		expect(attempt).toBe(2);
		const log = await readFile(logFile, 'utf8');
		expect(log).toContain('Start attempt 2 of 2 failed');
		expect(log).not.toContain(
			'2 of 2 failed: The agent server exited before listening. Trying again.',
		);
	});
});
