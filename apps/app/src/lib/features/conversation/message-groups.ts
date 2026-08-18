import type { ConversationMessage } from '@unity-agent/protocol';

/** Consecutive messages closer together than this share one header. */
export const groupWindowMs = 5 * 60_000;

export interface MessageGroup {
	id: string;
	role: ConversationMessage['role'];
	createdAt: number;
	messages: ConversationMessage[];
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
		const continues =
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
