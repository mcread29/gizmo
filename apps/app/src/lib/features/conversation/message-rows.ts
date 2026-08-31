import type { ConversationMessage } from '@gizmo/protocol';
import { groupMessages, type MessageGroup } from './message-groups';

export interface MessageRow extends MessageGroup {
	sourceMessageId: string;
	kind: 'message' | 'tool';
	activityTarget: boolean;
	groupedBefore: boolean;
	groupedAfter: boolean;
}

/** Splits transcript groups into independently measurable virtual rows. */
export function createMessageRows(
	messages: ConversationMessage[],
): MessageRow[] {
	return groupMessages(messages).flatMap((group) => {
		const splitRows = group.messages.flatMap(splitMessage);
		return splitRows.map((row, index) => ({
			id: row.message.id,
			role: group.role,
			createdAt: row.message.createdAt,
			messages: [row.message],
			sourceMessageId: row.sourceMessageId,
			kind: row.kind,
			activityTarget: index === splitRows.length - 1,
			groupedBefore: index > 0,
			groupedAfter: index < splitRows.length - 1,
		}));
	});
}

function splitMessage(message: ConversationMessage) {
	const rows: Array<{
		message: ConversationMessage;
		sourceMessageId: string;
		kind: MessageRow['kind'];
	}> = [];
	const hasMessageBody = Boolean(
		message.content ||
		message.reasoning ||
		message.reasoningRedacted ||
		message.attachments?.length ||
		message.tools.length === 0,
	);
	if (hasMessageBody) {
		rows.push({
			message: { ...message, tools: [] },
			sourceMessageId: message.id,
			kind: 'message',
		});
	}
	for (const tool of message.tools) {
		rows.push({
			message: {
				...message,
				id: `${message.id}:tool:${tool.id}`,
				content: '',
				reasoning: undefined,
				reasoningRedacted: undefined,
				attachments: undefined,
				tools: [tool],
			},
			sourceMessageId: message.id,
			kind: 'tool',
		});
	}
	return rows;
}
