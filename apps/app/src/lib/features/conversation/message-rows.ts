import type { ConversationMessage } from '@gizmo/protocol';
import { groupMessages, type MessageGroup } from './message-groups';

export interface MessageRow extends MessageGroup {
	sourceMessageId: string;
	kind: 'message' | 'tool' | 'event' | 'queued' | 'compacting';
	/** Text still waiting on the run in flight, for `queued` rows. */
	pending?: { text: string; delivery: 'steer' | 'followUp' };
	activityTarget: boolean;
	groupedBefore: boolean;
	groupedAfter: boolean;
}

/** Things happening to the thread right now that the transcript does not record. */
export interface PendingRows {
	steering: readonly string[];
	followUp: readonly string[];
	compacting: boolean;
}

/**
 * Splits transcript groups into independently measurable virtual rows, then
 * appends what is pending: queued messages and a compaction in progress
 * belong at the end of the thread, where the user is looking, rather than in
 * a notice somewhere else.
 */
export function createMessageRows(
	messages: ConversationMessage[],
	pending?: PendingRows,
): MessageRow[] {
	const rows = groupMessages(messages).flatMap((group) => {
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
	if (!pending) return rows;
	// Dated with the last message so no day separator appears above them.
	const createdAt = messages.at(-1)?.createdAt ?? Date.now();
	const queued = [
		...pending.steering.map((text) => ({ text, delivery: 'steer' as const })),
		...pending.followUp.map((text) => ({
			text,
			delivery: 'followUp' as const,
		})),
	].map((item, index) =>
		pendingRow(`queued:${item.delivery}:${index}`, 'queued', createdAt, item),
	);
	return [
		...rows,
		...queued,
		...(pending.compacting
			? [pendingRow('compacting', 'compacting', createdAt)]
			: []),
	];
}

function pendingRow(
	id: string,
	kind: 'queued' | 'compacting',
	createdAt: number,
	pending?: MessageRow['pending'],
): MessageRow {
	return {
		id,
		role: 'event',
		createdAt,
		messages: [],
		sourceMessageId: id,
		kind,
		...(pending ? { pending } : {}),
		activityTarget: false,
		groupedBefore: false,
		groupedAfter: false,
	};
}

/** Rough transcript metrics, used only to place rows before they are measured. */
const charactersPerLine = 88;
const lineHeight = 23;
/** Avatar row, heading and the gap that follows a group. */
const rowChrome = 64;
/** A collapsed tool card is a single fixed-height line. */
const toolRowHeight = 40;
const eventRowHeight = 60;
/**
 * Long messages measure many times taller than short ones, so a single constant
 * estimate leaves the virtualizer's placement wrong by thousands of pixels on a
 * long transcript — enough that scrolling to the end lands on blank space.
 * Estimating from content keeps the first paint close enough that the real
 * measurements only nudge it.
 */
export function estimateRowHeight(row: MessageRow): number {
	if (row.kind === 'tool') return toolRowHeight;
	if (row.kind === 'event' || row.kind === 'compacting') return eventRowHeight;
	if (row.kind === 'queued') {
		const lines =
			Math.ceil((row.pending?.text.length ?? 0) / charactersPerLine) || 1;
		return Math.min(600, eventRowHeight + lines * lineHeight);
	}
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
	if (message.role === 'event') {
		return [{ message, sourceMessageId: message.id, kind: 'event' as const }];
	}
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
