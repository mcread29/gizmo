/**
 * Unread bookkeeping for the transcript: everything after the last message
 * that was in view while following. Streaming appends to the same id, so a
 * growing reply does not count as new.
 */
export function countUnread(
	messages: ReadonlyArray<{ id: string }>,
	seenId: string | undefined,
): number {
	if (!seenId) return 0;
	const index = messages.findIndex(({ id }) => id === seenId);
	return index < 0 ? 0 : messages.length - 1 - index;
}

/** The first message after the last one read, where the "New" rule sits. */
export function firstUnread<T extends { id: string }>(
	messages: ReadonlyArray<T>,
	seenId: string | undefined,
): T | undefined {
	if (!seenId) return undefined;
	const index = messages.findIndex(({ id }) => id === seenId);
	return index < 0 ? undefined : messages[index + 1];
}

/** The row carrying the message, or -1 when it is not on screen yet. */
export function rowIndexOf(
	rows: ReadonlyArray<{ messages: ReadonlyArray<{ id: string }> }>,
	messageId: string,
): number {
	return rows.findIndex((row) =>
		row.messages.some(({ id }) => id === messageId),
	);
}
