import type { ConversationMessage } from '@gizmo/protocol';
import type { FakeSession } from './state';

export function appendMessageToTree(
	session: FakeSession,
	message: ConversationMessage,
) {
	session.messages.push(message);
	session.messageById.set(message.id, message);
	session.treeEntries.push({
		id: message.id,
		parentId: session.leafId,
		kind: message.role === 'event' ? 'compaction' : message.role,
		summary: message.content.slice(0, 120),
		detail: message.content,
		createdAt: message.createdAt,
	});
	session.leafId = message.id;
}
