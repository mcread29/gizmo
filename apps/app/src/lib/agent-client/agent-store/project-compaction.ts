import {
	defaultCompactionPolicy,
	type CompactionPolicy,
} from '@gizmo/protocol';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';

/**
 * The compaction policy belongs to the workspace and the server owns it, so
 * every client of a workspace compacts the same way. The store holds the
 * selected workspace's copy; later changes arrive as
 * `project.compaction.changed`, which the reducer applies.
 */
export async function refreshCompactionPolicy(
	store: AgentStore,
	client: AgentClient,
) {
	const projectPath = store.selectedProjectPath;
	if (store.connection !== 'connected' || !projectPath) {
		store.compactionPolicy = defaultCompactionPolicy;
		return;
	}
	const policy = await client.getProjectCompaction(projectPath);
	if (store.selectedProjectPath === projectPath) {
		store.compactionPolicy = policy;
	}
}

/** Optimistic: the meter and form follow at once, and revert on failure. */
export async function setCompactionPolicy(
	store: AgentStore,
	client: AgentClient,
	policy: CompactionPolicy,
) {
	const projectPath = store.selectedProjectPath;
	if (!projectPath) throw new Error('No workspace is selected');
	const previous = store.compactionPolicy;
	store.compactionPolicy = policy;
	try {
		await client.setProjectCompaction(projectPath, policy);
	} catch (error) {
		if (store.selectedProjectPath === projectPath) {
			store.compactionPolicy = previous;
		}
		throw error;
	}
}
