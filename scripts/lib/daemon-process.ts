import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { appendFile, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { join } from 'node:path';

export function isRunning(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export function delay(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitForExit(pid: number, timeoutMilliseconds: number) {
	const deadline = Date.now() + timeoutMilliseconds;
	while (Date.now() < deadline) {
		if (!isRunning(pid)) return true;
		await delay(100);
	}
	return !isRunning(pid);
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

/**
 * Detaches the supervisor with no console window. Windows has no equivalent
 * of a POSIX detached session, so a WSH shim launches the real command with
 * the window hidden and relays its exit code.
 */
export async function spawnHiddenWindowsRunner(
	runtimeDirectory: string,
	root: string,
	runnerArguments: string[],
) {
	const script = join(runtimeDirectory, 'hidden-runner.vbs');
	const commandFile = join(runtimeDirectory, 'hidden-runner.cmd');
	await Promise.all([
		writeFile(
			script,
			[
				'Set shell = CreateObject("WScript.Shell")',
				'command = Chr(34) & WScript.Arguments(0) & Chr(34)',
				'exitCode = shell.Run(command, 0, True)',
				'WScript.Quit exitCode',
				'',
			].join('\r\n'),
		),
		writeFile(
			commandFile,
			[
				'@echo off',
				[process.execPath, ...runnerArguments]
					.map((argument) => `"${argument.replaceAll('"', '""')}"`)
					.join(' '),
				'exit /b %errorlevel%',
				'',
			].join('\r\n'),
		),
	]);
	return spawn('wscript.exe', ['//nologo', script, commandFile], {
		cwd: root,
		detached: true,
		env: process.env,
		stdio: 'ignore',
		windowsHide: true,
	});
}
