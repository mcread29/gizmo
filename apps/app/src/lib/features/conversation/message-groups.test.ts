import type { ConversationMessage } from '@unity-agent/protocol';
import { describe, expect, it } from 'vitest';
import { formatDay, groupContent, groupMessages } from './message-groups';

function message(
	id: string,
	role: ConversationMessage['role'],
	createdAt: number,
	content = '',
): ConversationMessage {
	return { id, role, content, createdAt, complete: true, tools: [] };
}

describe('groupMessages', () => {
	it('merges a run of tool-only assistant messages into one block', () => {
		const groups = groupMessages([
			message('u1', 'user', 0, 'go'),
			message('a1', 'assistant', 1_000),
			message('a2', 'assistant', 2_000),
			message('a3', 'assistant', 3_000, 'done'),
		]);

		expect(groups).toHaveLength(2);
		expect(groups[1]?.messages.map(({ id }) => id)).toEqual(['a1', 'a2', 'a3']);
		expect(groups[1]?.createdAt).toBe(1_000);
	});

	it('starts a new block when the role changes', () => {
		const groups = groupMessages([
			message('a1', 'assistant', 0),
			message('u1', 'user', 1_000),
			message('a2', 'assistant', 2_000),
		]);

		expect(groups.map((group) => group.role)).toEqual([
			'assistant',
			'user',
			'assistant',
		]);
	});

	it('starts a new block after a long pause', () => {
		const groups = groupMessages([
			message('a1', 'assistant', 0),
			message('a2', 'assistant', 10 * 60_000),
		]);

		expect(groups).toHaveLength(2);
	});

	it('joins the text of a block for copying', () => {
		const groups = groupMessages([
			message('a1', 'assistant', 0, 'first'),
			message('a2', 'assistant', 1_000),
			message('a3', 'assistant', 2_000, 'second'),
		]);

		expect(groupContent(groups[0]!)).toBe('first\n\nsecond');
	});
});

describe('formatDay', () => {
	const now = new Date('2026-08-18T12:00:00').getTime();

	it('names the recent days rather than dating them', () => {
		expect(formatDay(now, now)).toBe('Today');
		expect(formatDay(now - 86_400_000, now)).toBe('Yesterday');
		expect(formatDay(new Date('2026-08-10T09:00:00').getTime(), now)).toMatch(
			/Aug/,
		);
	});
});
