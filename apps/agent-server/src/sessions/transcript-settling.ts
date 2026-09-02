import type {
	SessionEntry,
	SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import type { ToolCallView } from '@gizmo/protocol';

/** Providers report an abandoned turn through the message's stop reason. */
export function isStoppedTurn(message: unknown): boolean {
	if (!message || typeof message !== 'object') return false;
	const reason = (message as { stopReason?: unknown }).stopReason;
	return reason === 'aborted' || reason === 'error';
}

/** Entry id of the newest assistant message, the only one still able to run tools. */
export function lastAssistantEntryId(
	branch: SessionEntry[],
): string | undefined {
	for (let index = branch.length - 1; index >= 0; index -= 1) {
		const entry = branch[index];
		if (!entry || entry.type !== 'message') continue;
		if ((entry as SessionMessageEntry).message.role === 'assistant') {
			return entry.id;
		}
	}
}

/**
 * A tool call is recorded before it runs, so it starts out "running" and only a
 * matching tool result settles it. When a turn is aborted or errors mid-stream
 * that result never arrives, and because the transcript view is rebuilt from the
 * session file on every load, the call would otherwise read as running forever —
 * surviving reloads and restarts.
 *
 * Only the newest assistant message can still have tools in flight, and even it
 * cannot when the provider already reported the turn as stopped. Everything
 * else with no result is finished, unsuccessfully.
 */
export function settleOrphanedTools(
	tools: Map<string, ToolCallView>,
	owners: Map<string, string>,
	branch: SessionEntry[],
	lastAssistantId: string | undefined,
): void {
	const stopped = new Map<string, boolean>();
	for (const entry of branch) {
		if (entry.type !== 'message') continue;
		const message = (entry as SessionMessageEntry).message;
		if (message.role !== 'assistant') continue;
		stopped.set(entry.id, isStoppedTurn(message));
	}

	for (const [id, tool] of tools) {
		if (tool.status !== 'running') continue;
		const owner = owners.get(id);
		const couldStillRun =
			owner === lastAssistantId && !stopped.get(owner ?? '');
		if (couldStillRun) continue;
		tool.status = 'error';
		tool.statusText = 'Interrupted';
	}
}
