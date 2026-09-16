import { closeSync, openSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
	createDaemon,
	firstExit,
	stopProcessTree,
	waitForPort,
} from './lib/managed-daemon';

const root = join(__dirname, '..');
const runtimeDirectory = join(root, '.gizmo-web');

const agentPort = Number(process.env.GIZMO_PORT ?? 8787);
const webPort = Number(process.env.GIZMO_WEB_PORT ?? 4173);

/**
 * Hosts reachable in a browser. The built client derives its WebSocket URL
 * from `window.location`, so every host it is served on has to be an allowed
 * origin on the agent server as well.
 */
const webHosts = (process.env.GIZMO_WEB_HOSTS ?? 'localhost,127.0.0.1')
	.split(',')
	.map((host) => host.trim())
	.filter(Boolean);

const origins = webHosts.map((host) => `http://${host}:${webPort}`);

async function runManagedServer(logFile: string) {
	const logDescriptor = openSync(logFile, 'a');
	const requireFromApp = createRequire(
		join(root, 'apps', 'app', 'package.json'),
	);
	const tsxCli = createRequire(__filename).resolve('tsx/cli');

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
				GIZMO_PORT: String(agentPort),
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
		await waitForPort(agentPort, agent, 60_000);
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
				'--port',
				String(webPort),
				'--strictPort',
			],
			{
				cwd: join(root, 'apps', 'app'),
				env: {
					...process.env,
					GIZMO_WEB_ALLOWED_HOSTS: webHosts.join(','),
				},
				stdio: ['ignore', logDescriptor, logDescriptor],
				windowsHide: true,
			},
		);
		children.push(app);
		closeSync(logDescriptor);

		return await firstExit(children, logFile);
	} finally {
		for (const child of children) stopProcessTree(child.pid);
	}
}

createDaemon({
	label: 'Gizmo Web',
	root,
	runtimeDirectory,
	runnerScript: join(root, 'scripts', 'web-server.ts'),
	urls: webHosts.map((host) => `http://${host}:${webPort}`),
	run: runManagedServer,
}).run('Usage: pnpm web:server <start|stop|restart|status>');
