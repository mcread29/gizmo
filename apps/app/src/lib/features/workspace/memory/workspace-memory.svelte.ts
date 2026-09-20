import type {
	DigestOverride,
	JournalDigest,
	JournalFact,
	MemoryStatus,
} from '@gizmo/protocol';
import { untrack } from 'svelte';
import type { AgentStore } from '../../../agent-client';

/** Inheriting the global default is a third outcome, distinct from digesting
 *  nothing here, and only an override can say the latter. An empty value
 *  would read as "unset" to a select, so both carry a sentinel. */
export const inheritModel = 'inherit';
export const noModel = 'none';

/**
 * One workspace's derived memory: what the journal has been digested into,
 * and the settings that decide how.
 *
 * It loads with the Memory tab rather than with the screen, the way
 * WorkspaceConfiguration loads for all of them: none of this is stored in the
 * project config, and a visit to Overview should not pay for a journal read.
 */
export class WorkspaceMemory {
	/** Undefined until the first read for the current workspace lands. */
	status = $state<MemoryStatus>();
	digests = $state<JournalDigest[]>([]);
	facts = $state<JournalFact[]>([]);
	query = $state('');
	busy = $state(false);
	error = $state<string>();

	/** Told after every write, so Overview's list of what is overridden here
	 *  does not go stale behind this tab. */
	onOverrideChange: (() => void) | undefined;

	#store: AgentStore | undefined;
	#workspacePath: string | undefined;

	/**
	 * Loads one workspace, or clears when there is none. Returns the disposer
	 * an `$effect` needs: every read checks the path it started with, so
	 * switching workspaces cannot let a slow answer land on the new one.
	 */
	load(store: AgentStore, workspacePath: string | undefined): () => void {
		this.#store = store;
		this.#workspacePath = workspacePath;
		this.status = undefined;
		this.digests = [];
		this.facts = [];
		this.query = '';
		this.error = undefined;
		/*
		 * Untracked: the first read touches the filter and the connection on its
		 * way to the server, and the `$effect` that calls this would otherwise
		 * subscribe to both — so typing in the filter would reload the workspace
		 * and clear what was just typed.
		 */
		void untrack(() => this.refresh());
		return () => {
			this.#workspacePath = undefined;
		};
	}

	async refresh(): Promise<void> {
		const store = this.#store;
		const path = this.#workspacePath;
		if (!store || !path || store.connection !== 'connected') return;
		try {
			const [status, digests, facts] = await Promise.all([
				store.memory.memoryStatus(path),
				store.memory.memoryDigests(this.query || undefined, undefined, path),
				store.memory.memoryFacts(path),
			]);
			if (this.#workspacePath !== path) return;
			this.status = status;
			this.digests = digests;
			this.facts = facts;
			this.error = undefined;
		} catch (cause) {
			if (this.#workspacePath === path) this.error = message(cause);
		}
	}

	/**
	 * The filter and the read it triggers are one step: taking the query from
	 * the event rather than from a two-way binding keeps the server searching
	 * for what is on screen, whichever listener the browser runs first.
	 */
	async search(query: string): Promise<void> {
		this.query = query;
		await this.refresh();
	}

	/**
	 * Each setting is overridden on its own, the way an extension row is: the
	 * two keys travel in one override, so every write starts from the stored
	 * one rather than rebuilding it from the effective settings — which cannot
	 * tell a workspace that pinned the default's value from one inheriting it.
	 */
	async setModel(value: string): Promise<void> {
		const next = { ...this.status?.override };
		if (value === inheritModel) delete next.model;
		else if (value === noModel) next.model = null;
		else {
			const separator = value.indexOf('/');
			next.model =
				separator < 1
					? null
					: {
							provider: value.slice(0, separator),
							id: value.slice(separator + 1),
						};
		}
		await this.#save(next);
	}

	/** Undefined inherits the default again, as the row's reset does. */
	async setAuto(auto: boolean | undefined): Promise<void> {
		const next = { ...this.status?.override };
		if (auto === undefined) delete next.auto;
		else next.auto = auto;
		await this.#save(next);
	}

	/**
	 * A backfill runs for minutes on the server and reports progress through
	 * status, so the tab polls while one is in flight rather than holding a
	 * request open.
	 */
	async backfill(regenerate = false): Promise<void> {
		const store = this.#store;
		const path = this.#workspacePath;
		if (!store || !path) return;
		this.busy = true;
		try {
			const status = await store.memory.startMemoryBackfill(regenerate, path);
			if (this.#workspacePath === path) this.status = status;
		} catch (cause) {
			if (this.#workspacePath === path) this.error = message(cause);
		} finally {
			this.busy = false;
		}
	}

	async stop(): Promise<void> {
		const store = this.#store;
		const path = this.#workspacePath;
		if (!store || !path) return;
		try {
			const status = await store.memory.stopMemoryBackfill(path);
			if (this.#workspacePath === path) this.status = status;
		} catch {
			// Stopping a run that already finished is not worth a message.
		}
	}

	/** An override with no keys left is no override: the workspace inherits. */
	async #save(override: DigestOverride): Promise<void> {
		const store = this.#store;
		const path = this.#workspacePath;
		if (!store || !path) return;
		try {
			await store.memory.setMemoryOverride(
				Object.keys(override).length > 0 ? override : undefined,
				path,
			);
			await this.refresh();
			this.onOverrideChange?.();
		} catch (cause) {
			if (this.#workspacePath === path) this.error = message(cause);
		}
	}
}

function message(value: unknown) {
	return value instanceof Error ? value.message : String(value);
}
