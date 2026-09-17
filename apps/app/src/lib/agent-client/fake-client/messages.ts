import type { FakeSessionCapability } from './sessions';
import type { FakeClientState, FakeSession } from './state';
import { appendMessageToTree } from './tree';

/** Appends a turn to a fake session and announces it the way the server would. */
export function addFakeUserMessage(
	state: FakeClientState,
	sessions: FakeSessionCapability,
	sessionId: string,
	session: FakeSession,
	text: string,
) {
	const messageId = state.nextId('message');
	const createdAt = Date.now();
	const message = {
		id: messageId,
		role: 'user' as const,
		content: text,
		createdAt,
		complete: true,
		tools: [],
	};
	appendMessageToTree(session, message);
	session.summary.messageCount++;
	session.summary.lastActiveAt = Date.now();
	sessions.setTitleFromPrompt(session, text);
	state.emit({
		type: 'message.started',
		sessionId,
		messageId,
		role: 'user',
		createdAt: Date.now(),
	});
	state.emit({
		type: 'message.delta',
		sessionId,
		messageId,
		delta: text,
	});
	state.emit({ type: 'message.completed', sessionId, messageId });
	state.emit({ type: 'session.state', sessionId, state: 'streaming' });
}

export function addFakeAssistantMessage(
	state: FakeClientState,
	sessionId: string,
	session: FakeSession,
) {
	const id = state.nextId('message');
	const message = {
		id,
		role: 'assistant' as const,
		content: '',
		createdAt: Date.now(),
		complete: false,
		tools: [],
	};
	appendMessageToTree(session, message);
	session.summary.messageCount++;
	state.emit({
		type: 'message.started',
		sessionId,
		messageId: id,
		role: 'assistant',
		createdAt: Date.now(),
	});
	return { id, message };
}
