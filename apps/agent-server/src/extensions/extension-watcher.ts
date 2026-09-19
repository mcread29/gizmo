import { watch, type FSWatcher } from 'node:fs';
import { readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { reloadExtensions } from './extension-reload';
import { extensionsDir } from './registry-storage';

const debounceMs = 400;
const ignoredSegments = new Set(['node_modules', '.git', 'dist']);

export interface ExtensionWatcher {
	close(): void;
}

/**
 * Opt-in development watcher (`GIZMO_EXTENSION_WATCH=1`): follows every
 * linked extension to its registry source and reloads in place on change,
 * so server code re-evaluates and idle Pi runtimes restart. The process is
 * never restarted.
 */
export function startExtensionWatcher(): ExtensionWatcher | undefined {
	if (process.env.GIZMO_EXTENSION_WATCH !== '1') return undefined;
	const watchers = new Map<string, FSWatcher>();
	let pendingFull = false;
	let timer: NodeJS.Timeout | undefined;
	let closed = false;
	let flushing = false;

	const flush = async () => {
		timer = undefined;
		if (closed || flushing) return;
		flushing = true;
		pendingFull = false;
		try {
			await reloadExtensions();
		} catch (error) {
			console.error('Extension watcher reload failed:', error);
		} finally {
			flushing = false;
			if (!closed && pendingFull) schedule();
		}
		if (!closed) await syncWatchers();
	};

	const schedule = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void flush(), debounceMs);
		timer.unref?.();
	};

	const onChange = (file: string | null) => {
		if (!file) return;
		const segments = file.split(/[\\/]/);
		if (segments.some((segment) => ignoredSegments.has(segment))) return;
		pendingFull = true;
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
					onChange(file),
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
