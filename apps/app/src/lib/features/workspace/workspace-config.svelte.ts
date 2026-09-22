import type {
	DigestScope,
	ProjectConfig,
	ProjectDomains,
	WorkspaceExtension,
} from '@gizmo/protocol';
import type { AgentStore } from '../../agent-client';

/**
 * The stored configuration for one workspace, loaded once for the whole
 * workspace screen rather than once per tab: Overview summarises what the
 * other three tabs edit, so splitting Configure into pages must not turn one
 * fetch into four, and switching tabs must not refetch.
 */
export class WorkspaceConfiguration {
	/** Undefined until the first load for the current workspace lands. */
	config = $state<ProjectConfig>();
	/**
	 * What this workspace's memory runs under. Read here rather than on the
	 * Memory tab because Overview names every override before any tab is
	 * opened; it is the settings without the journal, so it costs one small
	 * read rather than a directory listing.
	 */
	memory = $state<DigestScope>();
	/** Gizmo domains from the retired profile system, kept for old installs. */
	domains = $state<ProjectDomains['domains']>([]);
	/**
	 * What the workspace's own `.gizmo/extensions` folder holds. Read with
	 * the config rather than watched: a folder appears when someone adds
	 * one, and Rescan is the cheaper answer than a watcher per workspace.
	 */
	workspaceExtensions = $state<WorkspaceExtension[]>([]);
	error = $state<string>();
	busyExtension = $state<string>();

	/**
	 * Loads one workspace, or clears when there is none. Returns the disposer
	 * an `$effect` needs so a superseded load cannot write back. The store is
	 * an argument rather than constructor state so the effect reads the prop
	 * where it runs, instead of capturing whatever it was at setup.
	 */
	load(store: AgentStore, workspacePath: string | undefined): () => void {
		this.config = undefined;
		this.memory = undefined;
		this.error = undefined;
		if (!workspacePath) return () => {};
		let current = true;
		void this.#loadMemory(store, workspacePath, () => current);
		void store.refreshResources(workspacePath);
		void store.refreshToolPolicy(workspacePath);
		void store
			.detectProject(workspacePath)
			.then(({ domains, config, workspaceExtensions }) => {
				if (!current) return;
				this.domains = domains;
				this.config = config ?? { version: 1 };
				this.workspaceExtensions = workspaceExtensions;
			})
			.catch((cause) => {
				if (current) this.error = message(cause);
			});
		return () => {
			current = false;
		};
	}

	/** Re-reads the extensions folder after someone adds one to it. */
	refreshWorkspaceExtensions(store: AgentStore, workspacePath: string): void {
		void store
			.detectProject(workspacePath)
			.then(({ workspaceExtensions }) => {
				this.workspaceExtensions = workspaceExtensions;
			})
			.catch((cause) => {
				this.error = message(cause);
			});
	}

	/** Re-reads the memory override after the Memory tab writes one. */
	refreshMemory(store: AgentStore, workspacePath: string): void {
		void this.#loadMemory(store, workspacePath, () => true);
	}

	async #loadMemory(
		store: AgentStore,
		workspacePath: string,
		current: () => boolean,
	): Promise<void> {
		try {
			const scope = await store.memory.memorySettings(workspacePath);
			if (current()) this.memory = scope;
		} catch {
			// Overview survives without it: the row it feeds is one of several,
			// and the Memory tab reports a failure of its own.
		}
	}

	/**
	 * Applies one change without touching anything else: the server returns
	 * the stored config and it is merged in place, so only the rows it affects
	 * re-render. Replacing catalogs here would flash and reflow the screen on
	 * every toggle.
	 */
	async reapply(work: Promise<ProjectConfig | void>): Promise<void> {
		this.error = undefined;
		try {
			const config = await work;
			if (config) this.config = config;
		} catch (cause) {
			this.error = message(cause);
		} finally {
			this.busyExtension = undefined;
		}
	}
}

function message(value: unknown) {
	return value instanceof Error ? value.message : String(value);
}
