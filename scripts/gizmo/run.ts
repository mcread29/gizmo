import { closeSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { firstExit, stopProcessTree, waitForPort } from '../lib/web-process';
import {
	bindAddress,
	hostsOf,
	isTailnetAddress,
	originsOf,
	type WebConfig,
} from './config';
import { appRoot, webLogFile, webPidFile } from './paths';
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

	const logDescriptor = openSync(logFile, 'a');
	// Task Scheduler's End only reaches the launched process. Recording the
	// pid lets `gizmo service stop` end the whole tree instead of leaving the
	// old server holding the ports behind a "restarted" one.
	writeFileSync(webPidFile(), String(process.pid));
	const requireFromApp = createRequire(
		join(root, 'apps', 'app', 'package.json'),
	);
	const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');

	// Production mode: no `tsx watch`, so an edit in the working tree never
	// restarts the server that other devices are connected to.
	const agent = spawn(
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
	const children = [agent];

	try {
		// Bring up the WebSocket backend before exposing the web server, so the
		// first page load does not race the extension integrations still loading.
		await waitForPort(config.agentPort, agent, 60_000);
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
		for (const child of children) stopProcessTree(child.pid);
		rmSync(webPidFile(), { force: true });
	}
}
