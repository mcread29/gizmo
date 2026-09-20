import type {
	DigestOverride,
	DigestScope,
	DigestSettings,
	JournalDigest,
	JournalFact,
	MemoryStatus,
} from '@gizmo/protocol';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';

/**
 * The journal's derived memory layer, scoped to one workspace.
 *
 * Every call needs a project because a journal belongs to one; the settings
 * are the exception, since the digest model is a property of which providers
 * are authenticated rather than of any repository. The workspace screen names
 * the project it is showing — which is not always the selected one, since
 * opening the screen and selecting the workspace do not land in the same tick
 * — and the selected workspace is the fallback for callers with no screen.
 */
export class MemoryCapability {
	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	#projectPath(explicit?: string): string {
		const projectPath = explicit ?? this.store.selectedProjectPath;
		if (!projectPath) throw new Error('No workspace is selected');
		return projectPath;
	}

	memoryStatus(projectPath?: string): Promise<MemoryStatus> {
		return this.client.memoryStatus(this.#projectPath(projectPath));
	}

	memoryDigests(
		query?: string,
		limit?: number,
		projectPath?: string,
	): Promise<JournalDigest[]> {
		return this.client.memoryDigests(
			this.#projectPath(projectPath),
			query,
			limit,
		);
	}

	memoryFacts(projectPath?: string): Promise<JournalFact[]> {
		return this.client.memoryFacts(this.#projectPath(projectPath));
	}

	/**
	 * The machine's default, or one workspace's view of it. The only memory
	 * call that takes no workspace at all: the defaults page edits what every
	 * workspace falls back to, and cannot assume one is selected.
	 */
	memorySettings(projectPath?: string): Promise<DigestScope> {
		return this.client.memorySettings(projectPath);
	}

	setMemoryDefaults(settings: DigestSettings): Promise<DigestSettings> {
		return this.client.setMemoryDefaults(settings);
	}

	setMemoryOverride(
		override?: DigestOverride,
		projectPath?: string,
	): Promise<DigestSettings> {
		return this.client.setMemoryOverride(
			this.#projectPath(projectPath),
			override,
		);
	}

	startMemoryBackfill(
		regenerate?: boolean,
		projectPath?: string,
	): Promise<MemoryStatus> {
		return this.client.startMemoryBackfill(
			this.#projectPath(projectPath),
			regenerate,
		);
	}

	stopMemoryBackfill(projectPath?: string): Promise<MemoryStatus> {
		return this.client.stopMemoryBackfill(this.#projectPath(projectPath));
	}
}
