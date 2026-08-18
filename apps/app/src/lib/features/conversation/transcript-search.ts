import type { ConversationMessage } from '@unity-agent/protocol';
import { toolSummary } from './tool-summary';

export interface TranscriptMatches {
	/**
	 * Ids of the individual things that matched, in transcript order: a message
	 * for its text, a tool call for its name and arguments. Counting whole
	 * messages would report "2 matches" for a reply containing twenty matching
	 * tool calls.
	 */
	ids: string[];
	set: ReadonlySet<string>;
}

export function findMatches(
	messages: ConversationMessage[],
	query: string,
): TranscriptMatches {
	const needle = query.trim().toLowerCase();
	if (!needle) return { ids: [], set: new Set() };

	const ids: string[] = [];
	for (const message of messages) {
		if (message.content.toLowerCase().includes(needle)) ids.push(message.id);
		for (const tool of message.tools) {
			const text = `${tool.name} ${toolSummary(tool.input) ?? ''} ${JSON.stringify(tool.input) ?? ''}`;
			if (text.toLowerCase().includes(needle)) ids.push(tool.id);
		}
	}
	return { ids, set: new Set(ids) };
}

/** Wraps around at both ends so repeated presses cycle the results. */
export function stepIndex(
	current: number,
	length: number,
	direction: 1 | -1,
): number {
	if (length === 0) return 0;
	return (current + direction + length) % length;
}
