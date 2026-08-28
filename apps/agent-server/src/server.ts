import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createAgentWebSocketServer } from './transport/websocket-server';
import { configuredOrigins } from './server-config';
import { CompositeProjectService } from '@gizmo/extensions';
import { ExtensionHostService } from './extensions/extension-host-service';
import {
	loadLinkedExtensionIntegrations,
	loadServerExtensions,
} from './extensions/load-extensions';
import { piAgentDir } from './resources/pi-global-resources';
import { registerExtensions } from './extensions/registry';
import { ProjectCatalog } from './projects/project-catalog';

await restoreDesktopEnvironment();

// Dev runs with the package dir as cwd; fall back to the repo root so a
// missing local config does not silently disable every extension.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const extensionsConfigPath =
	process.env.GIZMO_EXTENSIONS_CONFIG ??
	resolve(process.cwd(), 'gizmo.extensions.json');
const piWebMode = process.env.GIZMO_PI_WEB === '1';
const configuredExtensions = await loadServerExtensions(
	existsSync(extensionsConfigPath)
		? extensionsConfigPath
		: resolve(repoRoot, 'gizmo.extensions.json'),
);
const linkedExtensions = await loadLinkedExtensionIntegrations(
	join(piAgentDir(), 'extensions'),
);
const linkedIds = new Set(linkedExtensions.map(({ id }) => id));
const extensions = [
	...configuredExtensions.filter(({ id }) => !linkedIds.has(id)),
	...linkedExtensions,
];
registerExtensions(extensions);
const projects = new ProjectCatalog();
const projectServiceFactories = extensions
	.filter((extension) => extension.createProjectService)
	.map((extension) => extension.createProjectService!);

const host = process.env.GIZMO_HOST ?? '127.0.0.1';
const port = parsePort(process.env.GIZMO_PORT);
const allowedOrigins = configuredOrigins(process.env);
const agentServer = await createAgentWebSocketServer({
	host,
	port,
	createExtensionHost: () =>
		new ExtensionHostService(extensions, 5_000, async (workspacePath) =>
			(await projects.integrationsFor(workspacePath)).map(({ id }) => id),
		),
	...(projectServiceFactories.length
		? {
				createProjectService: () =>
					new CompositeProjectService(
						projectServiceFactories.map((create) => create()),
					),
			}
		: {}),
	...(allowedOrigins?.length ? { allowedOrigins } : {}),
});

console.log(
	`${piWebMode ? 'Pi Web' : 'Gizmo'} server listening on ws://${host}:${port}/agent`,
);

let closing = false;
async function close() {
	if (closing) return;
	closing = true;
	await agentServer.close();
}

process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());

// An unawaited rejection anywhere in a session/extension's async code would
// otherwise crash the process by default and drop every connected client
// with no diagnostic. Log it and close down cleanly instead of leaving the
// server in a half-crashed state.
process.on('uncaughtException', (error) => {
	console.error('Uncaught exception:', error);
	void close().finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
	console.error('Unhandled rejection:', reason);
	// Pi Web intentionally runs user-installed Pi extensions. A rejected
	// fire-and-forget task in one extension must not take down every thread.
	if (piWebMode) return;
	void close().finally(() => process.exit(1));
});

function parsePort(value: string | undefined): number {
	if (value === undefined) return 8787;
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid GIZMO_PORT: ${value}`);
	}
	return port;
}

async function restoreDesktopEnvironment(): Promise<void> {
	if (process.platform !== 'linux' || process.env.DISPLAY) return;
	try {
		const { stdout } = await promisify(execFile)('systemctl', [
			'--user',
			'show-environment',
		]);
		const desktopVariables = new Set([
			'DISPLAY',
			'WAYLAND_DISPLAY',
			'XAUTHORITY',
		]);
		for (const line of stdout.split('\n')) {
			const separator = line.indexOf('=');
			const key = line.slice(0, separator);
			if (separator > 0 && desktopVariables.has(key) && !process.env[key]) {
				process.env[key] = line.slice(separator + 1);
			}
		}
	} catch {
		// Headless Linux sessions legitimately have no user desktop environment.
	}
}
