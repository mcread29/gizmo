import { watch, type FSWatcher } from 'node:fs';
import { readdir, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { notifyExtensionsChanged, reloadExtensions } from './extension-reload';
import { extensionsDir } from './registry-storage';
import { rebuildLinkedWebBundles } from './web-build';

const debounceMs = 400;
const ignoredSegments = new Set(['node_modules', '.git', 'dist']);

export interface ExtensionWatcher {
	close(): void;
}

/**
 * Opt-in development watcher (`GIZMO_EXTENSION_WATCH=1`): follows every
 * linked extension to its registry source and reloads in place on change.
 * An edit under `src/web` only rebuilds that bundle and tells clients; any
 * other edit runs the full reload, so server code re-evaluates and idle Pi
 * runtimes restart. Neither restarts the process.
 */
export function startExtensionWatcher(): ExtensionWatcher | undefined {
	if (process.env.GIZMO_EXTENSION_WATCH !== '1') return undefined;
	const watchers = new Map<string, FSWatcher>();
	const pendingWeb = new Set<string>();
	let pendingFull = false;
	let timer: NodeJS.Timeout | undefined;
	let closed = false;
	let flushing = false;

	const flush = async () => {
		timer = undefined;
		if (closed || flushing) return;
		flushing = true;
		const full = pendingFull;
		const web = [...pendingWeb];
		pendingFull = false;
		pendingWeb.clear();
		try {
			if (full) await reloadExtensions();
			else if (web.length) {
				notifyExtensionsChanged(await rebuildLinkedWebBundles(web));
			}
		} catch (error) {
			console.error('Extension watcher reload failed:', error);
		} finally {
			flushing = false;
			if (!closed && (pendingFull || pendingWeb.size)) schedule();
		}
		if (!closed) await syncWatchers();
	};

	const schedule = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void flush(), debounceMs);
		timer.unref?.();
	};

	const onChange = (id: string, root: string, file: string | null) => {
		if (!file) return;
		const segments = file.split(/[\\/]/);
		if (segments.some((segment) => ignoredSegments.has(segment))) return;
		const inWeb = relative(root, join(root, file)).startsWith(
			`src${sep}web${sep}`,
		);
		if (inWeb) pendingWeb.add(id);
		else pendingFull = true;
		schedule();
	};

	/** Follows the current set of links; a link added or removed re-syncs. */
	const syncWatchers = async () => {
		let entries: string[] = [];
		try {
			entries = (await readdir(extensionsDir(), { withFileTypes: true }))
				.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
				.map((entry) => entry.name);
		} catch {
			// No extension directory yet; nothing to follow.
		}
		for (const [id, watcher] of watchers) {
			if (!entries.includes(id)) {
				watcher.close();
				watchers.delete(id);
			}
		}
		for (const id of entries) {
			if (watchers.has(id)) continue;
			try {
				const root = await realpath(join(extensionsDir(), id));
				const watcher = watch(root, { recursive: true }, (_event, file) =>
					onChange(id, root, file),
				);
				watcher.on('error', () => {
					watcher.close();
					watchers.delete(id);
				});
				watchers.set(id, watcher);
			} catch (error) {
				console.warn(`Not watching extension "${id}":`, error);
			}
		}
	};

	const linkWatcher = tryWatch(extensionsDir(), () => void syncWatchers());
	void syncWatchers();
	console.log('Watching linked extensions for changes');
	return {
		close() {
			closed = true;
			if (timer) clearTimeout(timer);
			linkWatcher?.close();
			for (const watcher of watchers.values()) watcher.close();
			watchers.clear();
		},
	};
}

function tryWatch(path: string, listener: () => void): FSWatcher | undefined {
	try {
		const watcher = watch(path, listener);
		watcher.on('error', () => watcher.close());
		return watcher;
	} catch {
		return undefined;
	}
}
