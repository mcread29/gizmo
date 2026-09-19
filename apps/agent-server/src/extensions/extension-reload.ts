import type { ExtensionReloadResult } from '@gizmo/protocol';
import {
	extensionCatalogGeneration,
	rescanExtensionCatalog,
} from './extension-catalog';
import { registeredExtensions } from './registry';

/**
 * What a full reload needs from the rest of the server. Configured once at
 * boot, after the transport exists, so registry actions and the file watcher
 * can trigger the same reload the `extensions.reload` request runs.
 */
export interface ExtensionReloadHooks {
	/** Recreates project services from the current catalog and re-watches. */
	refreshProjectServices(): Promise<void> | void;
	/** Reloads idle Pi runtimes; defers streaming ones. */
	reloadSessions(): Promise<{ reloaded: string[]; pending: string[] }>;
	/** Tells every connected client the catalog changed. */
	broadcast(result: ExtensionReloadResult): void;
	/** Tells clients an extension's status items or commands changed. */
	uiChanged(extensionId: string, projectPath?: string): void;
}

let hooks: ExtensionReloadHooks | undefined;
let tail: Promise<unknown> = Promise.resolve();
let queued: Promise<ExtensionReloadResult> | undefined;

export function configureExtensionReload(next: ExtensionReloadHooks): void {
	hooks = next;
}

/**
 * Reloads every linked extension in place: re-evaluates server integrations
 * from disk, rebuilds project services, reloads Pi runtimes, and broadcasts.
 * Callers queued before a pass starts share it. Requests arriving during a
 * pass queue another, so edits made after its scan are never lost. Before
 * hooks are configured (tests, or a server that has not finished booting)
 * only the catalog rescans.
 */
export function reloadExtensions(): Promise<ExtensionReloadResult> {
	if (queued) return queued;
	const next = tail.then(() => {
		queued = undefined;
		return runReload();
	});
	queued = next;
	tail = next.catch(() => {});
	return next;
}

/** What `activate(host)` calls; a no-op until the transport is wired. */
export function notifyExtensionUiChanged(
	extensionId: string,
	projectPath?: string,
): void {
	hooks?.uiChanged(extensionId, projectPath);
}

/** Tells clients the catalog changed without touching server-side code. */
export function notifyExtensionsChanged(diagnostics: string[] = []): void {
	hooks?.broadcast({
		generation: extensionCatalogGeneration(),
		extensions: registeredExtensions().map(({ id }) => id),
		reloadedSessions: [],
		pendingSessions: [],
		diagnostics,
	});
}

async function runReload(): Promise<ExtensionReloadResult> {
	const diagnostics: string[] = [];
	const extensions = await rescanExtensionCatalog();
	let reloaded: string[] = [];
	let pending: string[] = [];
	if (hooks) {
		try {
			await hooks.refreshProjectServices();
		} catch (error) {
			diagnostics.push(
				`Project services did not refresh: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		({ reloaded, pending } = await hooks.reloadSessions());
	}
	const result: ExtensionReloadResult = {
		generation: extensionCatalogGeneration(),
		extensions: (extensions.length ? extensions : registeredExtensions()).map(
			({ id }) => id,
		),
		reloadedSessions: reloaded,
		pendingSessions: pending,
		diagnostics,
	};
	hooks?.broadcast(result);
	return result;
}
