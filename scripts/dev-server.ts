import { closeSync, openSync } from 'node:fs';
import {
	appendFile,
	mkdir,
	readFile,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = join(__dirname, '..');
const runtimeDirectory = join(root, '.gizmo-dev');
const stateFile = join(runtimeDirectory, 'dev-server.json');
const logFile = join(runtimeDirectory, 'dev-server.log');

interface DevServerState {
	pid: number;
	startedAt: string;
}

function isRunning(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function readState() {
	try {
		const value = JSON.parse(
			await readFile(stateFile, 'utf8'),
		) as Partial<DevServerState>;
		if (
			typeof value.pid === 'number' &&
			Number.isInteger(value.pid) &&
			value.pid > 0 &&
			typeof value.startedAt === 'string'
		) {
			return value as DevServerState;
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	return undefined;
}

async function writeState(state: DevServerState) {
	await mkdir(dirname(stateFile), { recursive: true });
	const temporaryFile = `${stateFile}.${process.pid}.tmp`;
	await writeFile(temporaryFile, `${JSON.stringify(state, null, 2)}\n`);
	await rename(temporaryFile, stateFile);
}

function delay(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runManagedServer() {
	await appendFile(
		logFile,
		`\n--- Gizmo Pi Web started ${new Date().toISOString()} ---\n`,
	);
	const logDescriptor = openSync(logFile, 'a');
	const requireFromApp = createRequire(
		join(root, 'apps', 'app', 'package.json'),
	);
	process.env.GIZMO_PI_WEB = '1';
	const app = spawn(
		process.execPath,
		[
			join(
				dirname(requireFromApp.resolve('vite/package.json')),
				'bin',
				'vite.js',
			),
		],
		{
			cwd: join(root, 'apps', 'app'),
			env: process.env,
			stdio: ['pipe', logDescriptor, logDescriptor],
			windowsHide: true,
		},
	);
	closeSync(logDescriptor);

	try {
		// The runner already uses tsx's loader, so hosting the server here avoids
		// another Windows console process without changing server behavior.
		await import('../apps/agent-server/src/server.ts');
		process.exitCode = await new Promise<number>((resolve) => {
			app.once('error', (error) => {
				void appendFile(logFile, `${error.stack ?? error.message}\n`);
				resolve(1);
			});
			app.once('exit', (code) => resolve(code ?? 1));
		});
	} finally {
		stopProcessTree(app.pid);
	}
}

function stopProcessTree(pid: number | undefined) {
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

async function start() {
	const existing = await readState();
	if (existing && isRunning(existing.pid)) {
		console.log(`Gizmo Pi Web is already running (PID ${existing.pid}).`);
		return;
	}
	if (existing) await rm(stateFile, { force: true });

	await mkdir(runtimeDirectory, { recursive: true });
	const tsxCli = createRequire(__filename).resolve('tsx/cli');
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

async function spawnHiddenWindowsRunner(runnerArguments: string[]) {
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

async function waitForExit(pid: number, timeoutMilliseconds: number) {
	const deadline = Date.now() + timeoutMilliseconds;
	while (Date.now() < deadline) {
		if (!isRunning(pid)) return true;
		await delay(100);
	}
	return !isRunning(pid);
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
