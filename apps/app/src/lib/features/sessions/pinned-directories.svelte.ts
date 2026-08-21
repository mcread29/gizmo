const storageKey = 'unity-agent.pinned-directories.v1';

/**
 * Folder shortcuts for the workspace picker, e.g. `~/repos`. Kept across
 * restarts so a folder pinned once stays one click away.
 */
export class PinnedDirectoryStore {
	paths = $state<string[]>([]);
	readonly #storage: Storage | undefined;

	constructor(storage = browserStorage()) {
		this.#storage = storage;
		try {
			const stored = JSON.parse(storage?.getItem(storageKey) ?? 'null');
			if (Array.isArray(stored)) {
				this.paths = stored.filter((path) => typeof path === 'string');
			}
		} catch {
			// A corrupt pin list is not worth failing a launch over.
		}
	}

	has(path: string): boolean {
		return this.paths.includes(path);
	}

	toggle(path: string): void {
		this.paths = this.has(path)
			? this.paths.filter((item) => item !== path)
			: [...this.paths, path];
		try {
			this.#storage?.setItem(storageKey, JSON.stringify(this.paths));
		} catch {
			// Storage may be unavailable in a restricted webview.
		}
	}
}

function browserStorage(): Storage | undefined {
	return typeof localStorage === 'undefined' ? undefined : localStorage;
}
