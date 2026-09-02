import type { PiSessionLike } from './pi-agent-types';

/**
 * Text steered into a run that ended before delivering it.
 *
 * A steered message is queued against the run in flight and only handed to the
 * model when that run reaches its next call. A run that dies first — aborted
 * here, or dropped by the provider — never gets there, and the queue would
 * simply be discarded with it: the message is written to the transcript but
 * never reaches the model, and nothing tells the user.
 *
 * A settled session has no run left to deliver anything, so whatever is still
 * queued is stranded and belongs back in the composer. That is exactly what
 * Pi's own `clearQueue` is documented for.
 */
export function strandedMessages(session: PiSessionLike): string[] {
	if (!session.clearQueue || !session.pendingMessageCount) return [];
	const { steering, followUp } = session.clearQueue();
	return [...steering, ...followUp].filter((text) => text.trim());
}
