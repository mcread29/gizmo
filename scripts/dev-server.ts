import { appendFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
	delay,
	isRunning,
	logFile,
	readState,
	root,
	runtimeDirectory,
	stateFile,
	writeState,
} from './dev/dev-state';
import {
	runManagedServer,
	spawnHiddenWindowsRunner,
	waitForExit,
} from './dev/dev-process';

async function start() {
	const existing = await readState();
	if (existing && isRunning(existing.pid)) {
		console.log(`Gizmo Pi Web is already running (PID ${existing.pid}).`);
		return;
	}
	if (existing) await rm(stateFile, { force: true });

	await mkdir(runtimeDirectory, { recursive: true });
	const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
	const runnerArguments = [
		tsxCli,
		join(root, 'scripts', 'dev-server.ts'),
		'run',
	];
	const child =
		process.platform === 'win32'
			? await spawnHiddenWindowsRunner(runnerArguments)
			: spawn(process.execPath, runnerArguments, {
					cwd: root,
					detached: true,
					env: process.env,
					stdio: 'ignore',
				});
	if (!child.pid)
		throw new Error('The dev server process did not return a PID.');
	child.unref();

	await writeState({ pid: child.pid, startedAt: new Date().toISOString() });
	await delay(750);
	if (!isRunning(child.pid)) {
		await rm(stateFile, { force: true });
		throw new Error(`The dev server exited during startup. Check ${logFile}`);
	}
	console.log(`Started Gizmo Pi Web in the background (PID ${child.pid}).`);
	console.log('App: http://localhost:5173');
	console.log(`Log: ${logFile}`);
}

async function stop() {
	const state = await readState();
	if (!state || !isRunning(state.pid)) {
		await rm(stateFile, { force: true });
		console.log('Gizmo Pi Web is not running.');
		return;
	}

	if (process.platform === 'win32') {
		const result = spawnSync(
			'taskkill.exe',
			['/PID', String(state.pid), '/T', '/F'],
			{
				stdio: 'ignore',
				windowsHide: true,
			},
		);
		if (result.error) throw result.error;
	} else {
		try {
			process.kill(-state.pid, 'SIGTERM');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
		}
		if (!(await waitForExit(state.pid, 5_000))) {
			try {
				process.kill(-state.pid, 'SIGKILL');
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
			}
		}
	}

	await waitForExit(state.pid, 2_000);
	await rm(stateFile, { force: true });
	console.log(`Stopped Gizmo Pi Web (PID ${state.pid}).`);
}

async function status() {
	const state = await readState();
	if (state && isRunning(state.pid)) {
		console.log(
			`Gizmo Pi Web is running (PID ${state.pid}, started ${state.startedAt}).`,
		);
		console.log('App: http://localhost:5173');
		console.log(`Log: ${logFile}`);
		return;
	}
	if (state) await rm(stateFile, { force: true });
	console.log('Gizmo Pi Web is not running.');
	process.exitCode = 1;
}

async function main() {
	switch (process.argv[2]) {
		case 'start':
			await start();
			break;
		case 'stop':
			await stop();
			break;
		case 'restart':
			await stop();
			await start();
			break;
		case 'status':
			await status();
			break;
		case 'run':
			await runManagedServer();
			break;
		default:
			console.error('Usage: pnpm dev:server <start|stop|restart|status>');
			process.exitCode = 2;
	}
}

void main().catch((error: unknown) => {
	const message =
		error instanceof Error ? (error.stack ?? error.message) : String(error);
	console.error(message);
	void appendFile(logFile, `${message}\n`);
	process.exitCode = 1;
});
