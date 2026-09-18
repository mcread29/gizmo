import type {
	DigestOverride,
	DigestSettings,
	JournalDigest,
	MemoryStatus,
} from '@gizmo/protocol';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';

/**
 * The journal's derived memory layer, scoped to the selected workspace.
 *
 * Every call needs a project because a journal belongs to one; the settings
 * are the exception, since the digest model is a property of which providers
 * are authenticated rather than of any repository.
 */
export class MemoryCapability {
	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	#projectPath(): string {
		const projectPath = this.store.selectedProjectPath;
		if (!projectPath) throw new Error('No workspace is selected');
		return projectPath;
	}

	memoryStatus(): Promise<MemoryStatus> {
		return this.client.memoryStatus(this.#projectPath());
	}

	memoryDigests(query?: string, limit?: number): Promise<JournalDigest[]> {
		return this.client.memoryDigests(this.#projectPath(), query, limit);
	}

	setMemoryDefaults(settings: DigestSettings): Promise<DigestSettings> {
		return this.client.setMemoryDefaults(settings);
	}

	setMemoryOverride(override?: DigestOverride): Promise<DigestSettings> {
		return this.client.setMemoryOverride(this.#projectPath(), override);
	}

	startMemoryBackfill(regenerate?: boolean): Promise<MemoryStatus> {
		return this.client.startMemoryBackfill(this.#projectPath(), regenerate);
	}

	stopMemoryBackfill(): Promise<MemoryStatus> {
		return this.client.stopMemoryBackfill(this.#projectPath());
	}
}
