import type { AgentStore } from '../../agent-client';
import type { DraftStore } from './drafts.svelte';

/**
 * A steered message is queued against the run in flight and only delivered when
 * that run reaches its next model call. A run that dies first — aborted, or
 * dropped by the provider — never gets there, so the server hands the text back
 * and it returns to the composer ahead of whatever is already drafted.
 * Otherwise the message is silently gone, with nothing to tell the user it
 * never arrived.
 *
 * Returns whether anything was restored.
 */
export function restoreUnsent(store: AgentStore, drafts: DraftStore): boolean {
	if (store.unsent.length === 0) return false;
	const returned = store.takeUnsent();
	const existing = drafts.get(store.sessionId);
	drafts.set(
		store.sessionId,
		[...returned, ...(existing ? [existing] : [])].join('\n\n'),
	);
	return true;
}
