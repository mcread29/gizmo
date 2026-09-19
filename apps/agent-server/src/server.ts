import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { createAgentWebSocketServer } from './transport/websocket-server';
import { configuredOrigins } from './server-config';
import {
	ProjectServiceRegistry,
	type GizmoServerExtension,
} from '@gizmo/extension-api';
import { ExtensionHostService } from './extensions/extension-host-service';
import { ExtensionUiService } from './extensions/extension-ui-service';
import {
	configureExtensionCatalog,
	rescanExtensionCatalog,
} from './extensions/extension-catalog';
import { configureExtensionReload } from './extensions/extension-reload';
import { startExtensionWatcher } from './extensions/extension-watcher';
import { migrateExtensionEnablement } from './extensions/migrate-enablement';
import { migrateExtensionDirs } from './extensions/migrate-extension-dirs';
import { extensionsDir } from './extensions/registry-storage';
import { registeredExtensions } from './extensions/registry';
import { ProjectCatalog } from './projects/project-catalog';

await restoreDesktopEnvironment();
await migrateExtensionDirs();
await migrateExtensionEnablement();

const piWebMode = process.env.GIZMO_PI_WEB === '1';
const projects = new ProjectCatalog();
configureExtensionCatalog({
	linkedDir: extensionsDir(),
	// Project extensions are explicit paths in each project's Gizmo config,
	// loaded only for that project.
	projectExtensions: () => projects.projectExtensionPaths(),
});
// Registry link/unlink rescans through the same helper, so the catalog the
// rest of the server reads is always the boot scan or a later rescan of it.
const extensions = await rescanExtensionCatalog();

// One project service per extension id; requests name the extension they
// belong to and are routed directly to its service. The registry is rebuilt
// from the current catalog on every extension reload.
const projectServiceEntries = (catalog: readonly GizmoServerExtension[]) =>
	catalog
		.filter((extension) => extension.createProjectService)
		.map(
			(extension) => [extension.id, extension.createProjectService!()] as const,
		);
const projectServices = new ProjectServiceRegistry(
	projectServiceEntries(extensions),
);

const host = process.env.GIZMO_HOST ?? '127.0.0.1';
const port = parsePort(process.env.GIZMO_PORT);
const allowedOrigins = configuredOrigins(process.env);
const agentServer = await createAgentWebSocketServer({
	host,
	port,
	createExtensionHost: () =>
		new ExtensionHostService(
			registeredExtensions,
			5_000,
			async (workspacePath) =>
				(await projects.integrationsFor(workspacePath)).map(({ id }) => id),
		),
	createExtensionUi: (emit) =>
		new ExtensionUiService(registeredExtensions, emit, async (workspacePath) =>
			(await projects.integrationsFor(workspacePath)).map(({ id }) => id),
		),
	createProjectServices: () => projectServices,
	...(allowedOrigins?.length ? { allowedOrigins } : {}),
});

// Registry actions, the `extensions.reload` request, and the optional file
// watcher all run this same in-place reload instead of restarting.
configureExtensionReload({
	refreshProjectServices: async () => {
		await agentServer.services.ui.reset();
		projectServices.replace(projectServiceEntries(registeredExtensions()));
		await agentServer.services.watchCoordinator.refresh();
	},
	reloadSessions: () => agentServer.services.agent.reloadAllSessions(),
	broadcast: (result) =>
		agentServer.services.agent.events.emit('server', {
			type: 'extensions.reloaded',
			generation: result.generation,
			extensions: result.extensions,
		}),
	uiChanged: (extensionId, projectPath) =>
		agentServer.services.agent.events.emit('server', {
			type: 'extensions.ui.changed',
			extensionId,
			...(projectPath ? { projectPath } : {}),
		}),
});
const extensionWatcher = startExtensionWatcher();

console.log(
	`${piWebMode ? 'Pi Web' : 'Gizmo'} server listening on ws://${host}:${port}/agent`,
);

let closing = false;
async function close() {
	if (closing) return;
	closing = true;
	extensionWatcher?.close();
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
