import { closeSync, openSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { firstExit, stopProcessTree, waitForPort } from './lib/web-process';
import { reportSupervisedStatus } from './lib/supervised';

const root = join(__dirname, '..');
const runtimeDirectory = join(root, '.gizmo-web');
const logFile = join(runtimeDirectory, 'server.log');

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

const configuredOrigins = (process.env.GIZMO_WEB_ORIGINS ?? '')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);
// The page is served on every webHost (localhost, tailnet IPs and names),
// so all of those origins must be allowed even when extra public origins
// are configured; otherwise direct (non-Caddy) browsing gets a rejected
// socket. Configured origins are added, never substituted.
const origins = [
	...webHosts.map((host) => `http://${host}:${webPort}`),
	...configuredOrigins,
].filter((origin, index, all) => all.indexOf(origin) === index);

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

/**
 * Two verbs, because there are only two things anyone does with this server.
 *
 * `run` is what the "Gizmo Web" scheduled task invokes; it is the server. The
 * task owns starting, stopping and restarting it, so nothing here does. See
 * docs/web-server.md.
 */
async function main() {
	if (process.argv[2] === 'status') {
		await reportSupervisedStatus([
			{ port: agentPort, label: 'agent server' },
			{ port: webPort, label: 'web app' },
		]);
		return;
	}
	if (process.argv[2] !== 'run') {
		console.error('Usage: pnpm web:server <run|status>');
		process.exitCode = 2;
		return;
	}
	await mkdir(runtimeDirectory, { recursive: true });
	await appendFile(
		logFile,
		`\n--- Gizmo Web started ${new Date().toISOString()} ---\n`,
	);
	process.exitCode = await runManagedServer(logFile);
}

void main().catch((error: unknown) => {
	const message =
		error instanceof Error ? (error.stack ?? error.message) : String(error);
	console.error(message);
	void appendFile(logFile, `${message}\n`);
	process.exitCode = 1;
});
