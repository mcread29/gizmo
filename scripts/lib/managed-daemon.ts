import { spawn, spawnSync } from 'node:child_process';
import {
	appendFile,
	mkdir,
	readFile,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
	delay,
	isRunning,
	spawnHiddenWindowsRunner,
	waitForExit,
} from './daemon-process';

export {
	delay,
	firstExit,
	isRunning,
	stopProcessTree,
	waitForPort,
} from './daemon-process';

export interface DaemonDefinition {
	/** Human-readable name used in every console message. */
	label: string;
	/** Repo root; also the cwd of the detached supervisor. */
	root: string;
	/** Directory holding the state file, log file and Windows runner shims. */
	runtimeDirectory: string;
	/** Script the supervisor re-executes with the `run` verb. */
	runnerScript: string;
	/** Printed on start/status so the user knows where to point a browser. */
	urls: readonly string[];
	/** Boots the child processes and resolves with the exit code. */
	run(logFile: string): Promise<number>;
}

interface DaemonState {
	pid: number;
	startedAt: string;
}

export function createDaemon(definition: DaemonDefinition) {
	const { label, root, runtimeDirectory, runnerScript, urls } = definition;
	const stateFile = join(runtimeDirectory, 'server.json');
	const logFile = join(runtimeDirectory, 'server.log');

	async function readState() {
		try {
			const value = JSON.parse(
				await readFile(stateFile, 'utf8'),
			) as Partial<DaemonState>;
			if (
				typeof value.pid === 'number' &&
				Number.isInteger(value.pid) &&
				value.pid > 0 &&
				typeof value.startedAt === 'string'
			) {
				return value as DaemonState;
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		return undefined;
	}

	async function writeState(state: DaemonState) {
		await mkdir(dirname(stateFile), { recursive: true });
		const temporaryFile = `${stateFile}.${process.pid}.tmp`;
		await writeFile(temporaryFile, `${JSON.stringify(state, null, 2)}\n`);
		await rename(temporaryFile, stateFile);
	}

	function reportEndpoints() {
		for (const url of urls) console.log(`App: ${url}`);
		console.log(`Log: ${logFile}`);
	}

	async function start() {
		const existing = await readState();
		if (existing && isRunning(existing.pid)) {
			console.log(`${label} is already running (PID ${existing.pid}).`);
			return;
		}
		if (existing) await rm(stateFile, { force: true });

		await mkdir(runtimeDirectory, { recursive: true });
		const tsxCli = createRequire(import.meta.filename).resolve('tsx/cli');
		const runnerArguments = [tsxCli, runnerScript, 'run'];
		const child =
			process.platform === 'win32'
				? await spawnHiddenWindowsRunner(
						runtimeDirectory,
						root,
						runnerArguments,
					)
				: spawn(process.execPath, runnerArguments, {
						cwd: root,
						detached: true,
						env: process.env,
						stdio: 'ignore',
					});
		if (!child.pid) {
			throw new Error(`The ${label} process did not return a PID.`);
		}
		child.unref();

		await writeState({ pid: child.pid, startedAt: new Date().toISOString() });
		await delay(750);
		if (!isRunning(child.pid)) {
			await rm(stateFile, { force: true });
			throw new Error(`${label} exited during startup. Check ${logFile}`);
		}
		console.log(`Started ${label} in the background (PID ${child.pid}).`);
		reportEndpoints();
	}

	async function stop() {
		const state = await readState();
		if (!state || !isRunning(state.pid)) {
			await rm(stateFile, { force: true });
			console.log(`${label} is not running.`);
			return;
		}

		if (process.platform === 'win32') {
			const result = spawnSync(
				'taskkill.exe',
				['/PID', String(state.pid), '/T', '/F'],
				{ stdio: 'ignore', windowsHide: true },
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
		console.log(`Stopped ${label} (PID ${state.pid}).`);
	}

	async function status() {
		const state = await readState();
		if (state && isRunning(state.pid)) {
			console.log(
				`${label} is running (PID ${state.pid}, started ${state.startedAt}).`,
			);
			reportEndpoints();
			return;
		}
		if (state) await rm(stateFile, { force: true });
		console.log(`${label} is not running.`);
		process.exitCode = 1;
	}

	async function main(verb: string | undefined, usage: string) {
		switch (verb) {
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
			case 'run': {
				await mkdir(runtimeDirectory, { recursive: true });
				await appendFile(
					logFile,
					`\n--- ${label} started ${new Date().toISOString()} ---\n`,
				);
				process.exitCode = await definition.run(logFile);
				break;
			}
			default:
				console.error(usage);
				process.exitCode = 2;
		}
	}

	return {
		logFile,
		run(usage: string) {
			void main(process.argv[2], usage).catch((error: unknown) => {
				const message =
					error instanceof Error
						? (error.stack ?? error.message)
						: String(error);
				console.error(message);
				void appendFile(logFile, `${message}\n`);
				process.exitCode = 1;
			});
		},
	};
}
