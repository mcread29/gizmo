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
	/**
	 * Rebuilds the web bundles of linked extensions: only `ids` when given,
	 * otherwise the stale ones, or every one when forced.
	 */
	rebuildWebBundles?(
		ids: readonly string[] | undefined,
		force: boolean,
	): Promise<string[]>;
	/** Recreates project services from the current catalog and re-watches. */
	refreshProjectServices(): Promise<void> | void;
	/** Reloads idle Pi runtimes; defers streaming ones. */
	reloadSessions(): Promise<{ reloaded: string[]; pending: string[] }>;
	/** Tells every connected client the catalog changed. */
	broadcast(result: ExtensionReloadResult): void;
}

let hooks: ExtensionReloadHooks | undefined;
type ReloadOptions = { rebuild?: boolean | readonly string[] };
let tail: Promise<unknown> = Promise.resolve();
let queued:
	| { options: ReloadOptions; result: Promise<ExtensionReloadResult> }
	| undefined;

export function configureExtensionReload(next: ExtensionReloadHooks): void {
	hooks = next;
}

/**
 * Reloads every linked extension in place: re-evaluates server integrations
 * from disk, rebuilds project services, reloads Pi runtimes, and broadcasts.
 * Callers queued before a pass starts share it. Requests arriving during a
 * pass queue another, so edits made after its scan are never lost. Before
 * hooks are configured (tests, or
 * a server that has not finished booting) only the catalog rescans.
 */
/**
 * `rebuild`: `undefined` rebuilds bundles whose source changed, `true` forces
 * every bundle, `false` skips the build, an id list rebuilds exactly those.
 */
export function reloadExtensions(
	options: ReloadOptions = {},
): Promise<ExtensionReloadResult> {
	if (queued) {
		queued.options.rebuild = mergeRebuild(
			queued.options.rebuild,
			options.rebuild,
		);
		return queued.result;
	}
	const next = {
		options: { ...options },
		result: undefined as unknown as Promise<ExtensionReloadResult>,
	};
	next.result = tail.then(() => {
		queued = undefined;
		return runReload(next.options);
	});
	queued = next;
	tail = next.result.catch(() => {});
	return next.result;
}

function mergeRebuild(
	a: ReloadOptions['rebuild'],
	b: ReloadOptions['rebuild'],
): ReloadOptions['rebuild'] {
	if (a === true || b === true) return true;
	if (a === false) return b;
	if (b === false) return a;
	if (a === undefined || b === undefined) {
		// A targeted rebuild plus a stale scan must honor both requests.
		return Array.isArray(a) || Array.isArray(b) ? true : undefined;
	}
	return [...new Set([...a, ...b])];
}

/** Tells clients bundles changed without touching server-side code. */
export function notifyExtensionsChanged(diagnostics: string[] = []): void {
	hooks?.broadcast({
		generation: extensionCatalogGeneration(),
		extensions: registeredExtensions().map(({ id }) => id),
		reloadedSessions: [],
		pendingSessions: [],
		diagnostics,
	});
}

async function runReload(options: {
	rebuild?: boolean | readonly string[];
}): Promise<ExtensionReloadResult> {
	const diagnostics: string[] = [];
	const rebuild = options.rebuild;
	if (
		rebuild !== false &&
		hooks?.rebuildWebBundles &&
		(typeof rebuild !== 'object' || rebuild.length)
	) {
		try {
			diagnostics.push(
				...(await hooks.rebuildWebBundles(
					typeof rebuild === 'object' ? rebuild : undefined,
					rebuild === true,
				)),
			);
		} catch (error) {
			diagnostics.push(
				`Web bundle rebuild failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
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
