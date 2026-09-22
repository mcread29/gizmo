import { closeSync, openSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
	firstExit,
	startUntilListening,
	stopProcessTree,
} from '../lib/web-process';
import {
	bindAddress,
	hostsOf,
	isTailnetAddress,
	originsOf,
	type WebConfig,
} from './config';
import { appRoot, webLogFile } from './paths';
import { clearRunningServer, recordRunningServer } from './running';
import { tailnetNode } from './tailscale';

/**
 * `bind: "tailscale"` names an interface rather than an address, so the
 * address is resolved every start. A configured tailnet URL is the fallback,
 * which keeps the server up when `tailscale` is missing from the service's
 * PATH but the address has not changed.
 */
function resolveBindAddress(config: WebConfig): string {
	if (config.bind !== 'tailscale') return bindAddress(config.bind);
	let address: string | undefined;
	try {
		address = tailnetNode().ipv4;
	} catch {
		address = undefined;
	}
	address ??= config.urls
		.map((url) => new URL(url).hostname)
		.find((host) => isTailnetAddress(host) && host.includes('.'));
	return bindAddress('tailscale', address);
}

/** How long one agent start may take to open its port. */
const AGENT_START_TIMEOUT = 5 * 60_000;
/** How many starts to try before the service gives up. */
const AGENT_START_ATTEMPTS = 3;

export interface RunOptions {
	root?: string;
	logFile?: string;
}

export async function runServer(config: WebConfig, options: RunOptions = {}) {
	const root = options.root ?? appRoot;
	const logFile = options.logFile ?? webLogFile();
	const hosts = hostsOf(config);
	const origins = originsOf(config);
	const host = resolveBindAddress(config);

	await mkdir(dirname(logFile), { recursive: true });
	await appendFile(
		logFile,
		`\n--- Gizmo started ${new Date().toISOString()} ---\n` +
			`root ${root}\nbind ${config.bind} (${host}:${String(config.webPort)})\n` +
			`hosts ${hosts.join(',')}\norigins ${origins.join(',')}\n`,
	);

	// Task Scheduler's End only reaches the launched process. Recording the
	// pid lets `gizmo service stop` end the whole tree instead of leaving the
	// old server holding the ports behind a "restarted" one, and recording the
	// release lets `update` see which one is actually serving. Refusing to
	// start behind a live server is the point: taking the record from it would
	// strand it, and the ports are already gone anyway.
	try {
		await recordRunningServer(root);
	} catch (error) {
		await appendFile(logFile, `${(error as Error).message}\n`);
		throw error;
	}

	// A service manager stops the service with SIGTERM, which by default ends
	// Node without running the `finally` below: the children are orphaned and
	// the record outlives the server it describes.
	const children: ChildProcess[] = [];
	const onSignal = () => {
		for (const child of children) stopProcessTree(child.pid);
		clearRunningServer();
		process.exit(0);
	};
	process.once('SIGTERM', onSignal);
	process.once('SIGINT', onSignal);

	const logDescriptor = openSync(logFile, 'a');
	const requireFromApp = createRequire(
		join(root, 'apps', 'app', 'package.json'),
	);
	const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');

	// Production mode: no `tsx watch`, so an edit in the working tree never
	// restarts the server that other devices are connected to.
	const spawnAgent = () =>
		spawn(
			process.execPath,
			[tsxCli, join(root, 'apps', 'agent-server', 'src', 'server.ts')],
			{
				cwd: join(root, 'apps', 'agent-server'),
				env: {
					...process.env,
					GIZMO_PI_WEB: '1',
					// The agent server stays bound to loopback. Remote devices reach it
					// only through the Vite preview proxy, so there is exactly one
					// listener exposed to the tailnet.
					GIZMO_HOST: '127.0.0.1',
					GIZMO_PORT: String(config.agentPort),
					GIZMO_ORIGINS: origins.join(','),
				},
				stdio: ['ignore', logDescriptor, logDescriptor],
				windowsHide: true,
			},
		);

	try {
		// Bring up the WebSocket backend before exposing the web server, so the
		// first page load does not race the extension integrations still loading.
		// The agent server compiles from source and loads every extension on the
		// way up, which on a machine that has just booted can take minutes while
		// everything else starts. A start that never makes it is retried rather
		// than abandoned: the service manager only restarts a task it could not
		// launch, so an early exit here would leave the server down until the
		// next login.
		const agent = await startUntilListening(
			spawnAgent,
			config.agentPort,
			logFile,
			{
				timeoutMilliseconds: AGENT_START_TIMEOUT,
				attempts: AGENT_START_ATTEMPTS,
			},
		);
		children.push(agent);
		const app = spawn(
			process.execPath,
			[
				join(
					dirname(requireFromApp.resolve('vite/package.json')),
					'bin',
					'vite.js',
				),
				'preview',
				'--host',
				host,
				'--port',
				String(config.webPort),
				'--strictPort',
			],
			{
				cwd: join(root, 'apps', 'app'),
				env: { ...process.env, GIZMO_WEB_ALLOWED_HOSTS: hosts.join(',') },
				stdio: ['ignore', logDescriptor, logDescriptor],
				windowsHide: true,
			},
		);
		children.push(app);
		closeSync(logDescriptor);

		return await firstExit(children, logFile);
	} finally {
		process.off('SIGTERM', onSignal);
		process.off('SIGINT', onSignal);
		for (const child of children) stopProcessTree(child.pid);
		clearRunningServer();
	}
}
