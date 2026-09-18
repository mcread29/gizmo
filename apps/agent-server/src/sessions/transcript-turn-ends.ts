import type {
	SessionEntry,
	SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import type { ConversationMessage } from '@gizmo/protocol';

/*
 * A persisted turn has no end timestamp of its own: the file records when
 * each entry was written, and the turn ended when the last of them was —
 * usually a tool result, which is an entry but not a message of its own. The
 * final assistant message of every turn therefore takes the timestamp of the
 * newest entry before the next user message.
 */
export function stampTurnEnds(
	messages: ConversationMessage[],
	branch: readonly SessionEntry[],
): void {
	const byId = new Map(messages.map((message) => [message.id, message]));
	let lastAssistant: ConversationMessage | undefined;
	let turnEnd = 0;
	const close = () => {
		if (lastAssistant && turnEnd > lastAssistant.createdAt) {
			lastAssistant.completedAt = turnEnd;
		}
		lastAssistant = undefined;
	};
	for (const entry of branch) {
		const at = entryTime(entry);
		const message = byId.get(entry.id);
		if (message?.role === 'user') {
			close();
			turnEnd = at;
			continue;
		}
		turnEnd = Math.max(turnEnd, at);
		if (message?.role === 'assistant') lastAssistant = message;
	}
	close();
}

function entryTime(entry: SessionEntry): number {
	if (entry.type === 'message') {
		const { message } = entry as SessionMessageEntry;
		if (typeof message.timestamp === 'number') return message.timestamp;
	}
	return Date.parse(entry.timestamp) || 0;
}
