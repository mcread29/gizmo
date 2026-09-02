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

/** Rough transcript metrics, used only to place rows before they are measured. */
const charactersPerLine = 88;
const lineHeight = 23;
/** Avatar row, heading and the gap that follows a group. */
const rowChrome = 64;
/** A collapsed tool card is a single summary line. */
const toolRowHeight = 52;
/**
 * Long messages measure many times taller than short ones, so a single constant
 * estimate leaves the virtualizer's placement wrong by thousands of pixels on a
 * long transcript — enough that scrolling to the end lands on blank space.
 * Estimating from content keeps the first paint close enough that the real
 * measurements only nudge it.
 */
export function estimateRowHeight(row: MessageRow): number {
	if (row.kind === 'tool') return toolRowHeight;
	const message = row.messages[0];
	if (!message) return rowChrome + lineHeight;
	const characters =
		(message.content?.length ?? 0) + (message.reasoning?.length ?? 0);
	const attachments = (message.attachments?.length ?? 0) * 60;
	const lines = Math.ceil(characters / charactersPerLine) || 1;
	// Capped: a pathological paste should not hand the virtualizer a scroll
	// height that dwarfs everything measured around it.
	return Math.min(6000, rowChrome + lines * lineHeight + attachments);
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
