import { closeSync, openSync } from 'node:fs';
import { appendFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { connect } from 'node:net';
import { createRequire } from 'node:module';
import { delay, isRunning, logFile, root, runtimeDirectory } from './dev-state';

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

export function portOpen(port: number) {
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

/** The `run` command: hosts the agent server and the Vite app, logs to file. */
export async function runManagedServer() {
	await appendFile(
		logFile,
		`
--- Gizmo Pi Web started ${new Date().toISOString()} ---
`,
	);
	const logDescriptor = openSync(logFile, 'a');
	const requireFromApp = createRequire(
		join(root, 'apps', 'app', 'package.json'),
	);
	const tsxCli = createRequire(__filename).resolve('tsx/cli');
	process.env.GIZMO_PI_WEB = '1';
	const port = Number(process.env.GIZMO_PORT ?? 8787);

	// The agent runs under `tsx watch`, so edits to the server or to any
	// workspace package it imports (protocol, extensions) restart it in place.
	// The browser client reconnects on its own.
	const agent = spawn(
		process.execPath,
		[
			tsxCli,
			'watch',
			'--clear-screen=false',
			join(root, 'apps', 'agent-server', 'src', 'server.ts'),
		],
		{
			cwd: join(root, 'apps', 'agent-server'),
			env: process.env,
			// tsx watch listens on stdin for manual restarts and never boots the
			// program when handed a pipe that nothing writes to.
			stdio: ['ignore', logDescriptor, logDescriptor],
			windowsHide: true,
		},
	);
	const children = [agent];

	try {
		// Bring up the WebSocket backend before exposing Vite. Otherwise Vite is
		// ready several seconds earlier and the browser displays connection errors
		// while extension integrations are still loading.
		await waitForPort(port, agent, 60_000);
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
		children.push(app);
		closeSync(logDescriptor);

		// Either process dying takes the pair down; a half-running dev server
		// is more confusing than a stopped one.
		process.exitCode = await new Promise<number>((resolve) => {
			for (const child of children) {
				child.once('error', (error) => {
					void appendFile(
						logFile,
						`${error.stack ?? error.message}
`,
					);
					resolve(1);
				});
				child.once('exit', (code) => resolve(code ?? 1));
			}
		});
	} finally {
		for (const child of children) stopProcessTree(child.pid);
	}
}

/**
 * Windows hides detached node processes behind wscript so no console window
 * flashes; the .cmd shim carries the command line and forwards the exit code.
 */
export async function spawnHiddenWindowsRunner(runnerArguments: string[]) {
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

export async function waitForExit(pid: number, timeoutMilliseconds: number) {
	const deadline = Date.now() + timeoutMilliseconds;
	while (Date.now() < deadline) {
		if (!isRunning(pid)) return true;
		await delay(100);
	}
	return !isRunning(pid);
}
