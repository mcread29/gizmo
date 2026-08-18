import {
	findCutPoint,
	type SessionEntry,
} from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

function message(
	id: string,
	role: 'user' | 'assistant',
	content: string,
): SessionEntry {
	const value =
		role === 'assistant'
			? {
					role,
					content: [{ type: 'text', text: content }],
					timestamp: Date.now(),
					api: 'anthropic-messages',
					provider: 'anthropic',
					model: 'test',
					usage: {},
					stopReason: 'stop',
				}
			: { role, content, timestamp: Date.now() };
	return {
		type: 'message',
		id,
		parentId: null,
		timestamp: new Date().toISOString(),
		message: value,
	} as unknown as SessionEntry;
}

describe('full-turn compaction boundaries', () => {
	it('snaps a target inside an assistant response to its user message', () => {
		const entries = [
			message('u1', 'user', 'first'),
			message('a1', 'assistant', 'first reply'),
			message('u2', 'user', 'second'),
			message('a2', 'assistant', 'second reply'),
		];

		expect(findCutPoint(entries, 0, entries.length, 1, false)).toMatchObject({
			firstKeptEntryIndex: 3,
			isSplitTurn: true,
		});
		expect(findCutPoint(entries, 0, entries.length, 1, true)).toMatchObject({
			firstKeptEntryIndex: 2,
			isSplitTurn: false,
		});
	});
});
