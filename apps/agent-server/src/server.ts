import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createAgentWebSocketServer } from './transport/websocket-server';
import { configuredOrigins } from './server-config';
import { ExtensionHostService } from './extensions/extension-host-service';
import { loadServerExtensions } from './extensions/load-extensions';
import { registerExtensions } from './extensions/registry';

await restoreDesktopEnvironment();

// Dev runs with the package dir as cwd; fall back to the repo root so a
// missing local config does not silently disable every extension.
const repoRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../..',
);
const extensionsConfigPath =
	process.env.GIZMO_EXTENSIONS_CONFIG ??
	resolve(process.cwd(), 'gizmo.extensions.json');
const extensions = await loadServerExtensions(
	existsSync(extensionsConfigPath)
		? extensionsConfigPath
		: resolve(repoRoot, 'gizmo.extensions.json'),
);
registerExtensions(extensions);
const projectServiceExtension = extensions.find(
	(extension) => extension.createProjectService,
);

const host =
	process.env.GIZMO_HOST ?? process.env.UNITY_AGENT_HOST ?? '127.0.0.1';
const port = parsePort(process.env.GIZMO_PORT ?? process.env.UNITY_AGENT_PORT);
const allowedOrigins = configuredOrigins(process.env);
const agentServer = await createAgentWebSocketServer({
	host,
	port,
	createExtensionHost: () => new ExtensionHostService(extensions),
	...(projectServiceExtension
		? {
				createProjectService: () =>
					projectServiceExtension.createProjectService!(),
			}
		: {}),
	...(allowedOrigins?.length ? { allowedOrigins } : {}),
});

console.log(`Gizmo server listening on ws://${host}:${port}/agent`);

let closing = false;
async function close() {
	if (closing) return;
	closing = true;
	await agentServer.close();
}

process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());

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
