import type { SessionManager } from '@earendil-works/pi-coding-agent';
import type { SessionSnapshot } from '@gizmo/protocol';
import { readUsage } from './pi-event-translator';
import { inFlightAssistantView } from './session-transcript';
import type { AgentEventHub } from './agent-event-hub';
import type { PiSessionLike } from './pi-agent-types';

/** Decorates usage events with the session's context window when known. */
export function withContextWindow(
	session: PiSessionLike,
	event: Parameters<AgentEventHub['emit']>[1],
) {
	if (event.type !== 'session.usage' || !session.model?.contextWindow)
		return event;
	return {
		...event,
		usage: { ...event.usage, contextWindow: session.model.contextWindow },
	};
}

/**
 * Replays the most recent assistant usage from the branch, so a client that
 * (re)connects mid-session sees real token counts without waiting for a turn.
 */
export function emitUsageSnapshot(
	events: AgentEventHub,
	sessionId: string,
	session: PiSessionLike,
	manager: SessionManager,
) {
	if (typeof manager.getBranch !== 'function') return;
	const branch = manager.getBranch();
	for (let index = branch.length - 1; index >= 0; index -= 1) {
		const entry = branch[index];
		if (entry.type !== 'message' || entry.message.role !== 'assistant')
			continue;
		const usage = readUsage(entry.message.usage);
		if (!usage) continue;
		events.emit(
			sessionId,
			withContextWindow(session, { type: 'session.usage', usage }),
		);
		return;
	}
}

/**
 * Appends the assistant message still being streamed, so a snapshot taken
 * while a turn is in flight shows the partial answer instead of dropping it.
 * The caller checks streaming; the id and live messages carry the rest.
 */
export function spliceInFlightMessage(
	snapshot: SessionSnapshot,
	messageId: string | undefined,
	messages: PiSessionLike['messages'],
) {
	const last = messages?.at(-1);
	if (!messageId || !last || last.role !== 'assistant') return;
	snapshot.messages = [
		...snapshot.messages,
		inFlightAssistantView(
			{ role: 'assistant', content: last.content, timestamp: last.timestamp },
			messageId,
		),
	];
}
