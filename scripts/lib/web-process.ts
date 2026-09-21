import { spawnSync, type ChildProcess } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { connect } from 'node:net';

function delay(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Resolves once something accepts TCP connections on the port. */
export async function waitForPort(
	port: number,
	owner: ChildProcess,
	timeoutMilliseconds: number,
) {
	const deadline = Date.now() + timeoutMilliseconds;
	while (Date.now() < deadline) {
		if (owner.exitCode !== null) {
			throw new Error(`The agent server exited before listening on ${port}.`);
		}
		if (await portOpen(port)) return;
		await delay(250);
	}
	throw new Error(`The agent server did not listen on ${port} in time.`);
}

function portOpen(port: number) {
	return new Promise<boolean>((resolve) => {
		const socket = connect({ port, host: '127.0.0.1' });
		const done = (open: boolean) => {
			socket.destroy();
			resolve(open);
		};
		socket.once('connect', () => done(true));
		socket.once('error', () => done(false));
		socket.setTimeout(1_000, () => done(false));
	});
}

export interface StartOptions {
	timeoutMilliseconds: number;
	attempts: number;
}

/**
 * Starts `spawnChild` and waits for it to listen on `port`, trying again
 * when it exits early or runs out of time. Each failed attempt is written to
 * `logFile` next to the child's own output, so a server that never came up
 * leaves a reason behind rather than a bare exit code in the service log.
 */
export async function startUntilListening(
	spawnChild: () => ChildProcess,
	port: number,
	logFile: string,
	options: StartOptions,
): Promise<ChildProcess> {
	for (let attempt = 1; ; attempt += 1) {
		const child = spawnChild();
		try {
			await waitForPort(port, child, options.timeoutMilliseconds);
			return child;
		} catch (error) {
			stopProcessTree(child.pid);
			const reason = error instanceof Error ? error.message : String(error);
			const last = attempt >= options.attempts;
			await appendFile(
				logFile,
				`Start attempt ${String(attempt)} of ${String(options.attempts)} failed: ${reason}` +
					(last ? '\n' : ' Trying again.\n'),
			);
			if (last) throw error;
		}
	}
}

export function stopProcessTree(pid: number | undefined) {
	if (!pid) return;
	if (process.platform === 'win32') {
		spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true,
		});
		return;
	}
	try {
		process.kill(pid, 'SIGTERM');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
	}
}

/**
 * Waits for the first of `children` to exit and reports its code. Either
 * process dying takes the pair down; a half-running server is more confusing
 * than a stopped one.
 */
export function firstExit(children: readonly ChildProcess[], logFile: string) {
	return new Promise<number>((resolve) => {
		for (const child of children) {
			child.once('error', (error) => {
				void appendFile(logFile, `${error.stack ?? error.message}\n`);
				resolve(1);
			});
			child.once('exit', (code) => resolve(code ?? 1));
		}
	});
}
