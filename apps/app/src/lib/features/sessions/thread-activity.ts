import type { AgentStore } from '../../agent-client';

/** Threads in a workspace that want the user back: a run or a question. */
export function threadActivity(
	store: Pick<AgentStore, 'isSessionStreaming'>,
	waitingIds: ReadonlySet<string>,
	threads: ReadonlyArray<{ id: string }>,
) {
	let running = 0;
	let waiting = 0;
	for (const { id } of threads) {
		if (waitingIds.has(id)) waiting++;
		else if (store.isSessionStreaming(id)) running++;
	}
	return { running, waiting };
}
