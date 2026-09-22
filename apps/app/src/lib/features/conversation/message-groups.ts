import type { ConversationMessage } from '@gizmo/protocol';

/** Consecutive messages closer together than this share one header. */
export const groupWindowMs = 5 * 60_000;

export interface MessageGroup {
	id: string;
	role: ConversationMessage['role'];
	createdAt: number;
	messages: ConversationMessage[];
	/** When the run this block belongs to began; defaults to its own start. */
	turnStartedAt?: number;
}

/**
 * Runs of consecutive same-role messages, so a reply made of eight tool calls
 * is one block with one header rather than eight avatars and eight identical
 * timestamps.
 */
export function groupMessages(
	messages: ConversationMessage[],
	windowMs = groupWindowMs,
): MessageGroup[] {
	const groups: MessageGroup[] = [];
	for (const message of messages) {
		const current = groups.at(-1);
		// Events mark a point in the thread; each stands on its own.
		const continues =
			message.role !== 'event' &&
			current?.role === message.role &&
			message.createdAt - (current.messages.at(-1)?.createdAt ?? 0) <= windowMs;
		if (continues) current.messages.push(message);
		else {
			groups.push({
				id: message.id,
				role: message.role,
				createdAt: message.createdAt,
				messages: [message],
			});
		}
	}
	return groups;
}

/**
 * How long the agent worked on a finished reply: from the start of the run to
 * the moment it stopped. Only the last message of a turn carries an end, so
 * this is undefined everywhere else — including while the turn is still
 * going, and on transcripts written before turns recorded one.
 */
export function workedMs(group: MessageGroup): number | undefined {
	if (group.role !== 'assistant') return undefined;
	const completedAt = group.messages.at(-1)?.completedAt;
	if (!completedAt) return undefined;
	const worked = completedAt - (group.turnStartedAt ?? group.createdAt);
	return worked > 0 ? worked : undefined;
}

export function groupContent(group: MessageGroup): string {
	return group.messages
		.map((message) => message.content)
		.filter(Boolean)
		.join('\n\n');
}

/** Local calendar day, used to decide where a date separator belongs. */
export function dayKey(timestamp: number): string {
	return new Date(timestamp).toDateString();
}

export function formatDay(timestamp: number, now = Date.now()): string {
	const day = dayKey(timestamp);
	if (day === dayKey(now)) return 'Today';
	if (day === dayKey(now - 86_400_000)) return 'Yesterday';
	return new Intl.DateTimeFormat([], {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	}).format(timestamp);
}

/**
 * Tool calls across the whole turn that ends at `messageId`: the footer sits
 * on the turn's last row, but a turn is one message per step, each with its
 * own tools, so counting the last message alone undercounted.
 */
export function turnToolCount(
	messages: ReadonlyArray<{ id: string; role: string; tools: unknown[] }>,
	messageId: string,
): number {
	const end = messages.findIndex(({ id }) => id === messageId);
	if (end < 0) return 0;
	let count = 0;
	for (let index = end; index >= 0; index--) {
		const message = messages[index]!;
		if (message.role !== 'assistant') break;
		count += message.tools.length;
	}
	return count;
}
