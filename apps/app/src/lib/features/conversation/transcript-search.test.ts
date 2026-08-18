import type { ConversationMessage } from '@unity-agent/protocol';
import { describe, expect, it } from 'vitest';
import { findMatches, stepIndex } from './transcript-search';

const messages: ConversationMessage[] = [
	{
		id: 'm1',
		role: 'user',
		content: 'Check the water shader',
		createdAt: 0,
		complete: true,
		tools: [],
	},
	{
		id: 'm2',
		role: 'assistant',
		content: 'Looking now',
		createdAt: 1,
		complete: true,
		tools: [
			{
				id: 't1',
				name: 'unity_command',
				status: 'complete',
				statusText: 'Completed',
				input: { command: 'bake_lighting' },
			},
		],
	},
];

describe('findMatches', () => {
	it('matches message text regardless of case', () => {
		expect(findMatches(messages, 'SHADER').ids).toEqual(['m1']);
	});

	it('matches tool names and arguments, not just prose', () => {
		expect(findMatches(messages, 'bake_lighting').ids).toEqual(['t1']);
		expect(findMatches(messages, 'unity_command').ids).toEqual(['t1']);
	});

	it('matches Unity TypeScript source', () => {
		const scripted: ConversationMessage = {
			...messages[1]!,
			id: 'm-script',
			content: '',
			tools: [
				{
					id: 'script-1',
					name: 'unity_script',
					status: 'complete',
					statusText: 'Completed',
					input: {
						code: 'const command = "first";\nawait unity.commands["scene.validate"]({});',
					},
				},
			],
		};

		expect(findMatches([scripted], 'scene.validate').ids).toEqual(['script-1']);
	});

	// A reply made of twenty matching tool calls is twenty results, not one.
	it('counts each matching tool call rather than its message', () => {
		const many: ConversationMessage = {
			...messages[1]!,
			id: 'm3',
			content: '',
			tools: ['a', 'b', 'c'].map((id) => ({
				id,
				name: 'unity_list_commands',
				status: 'complete' as const,
				statusText: 'Completed',
				input: { query: id },
			})),
		};

		expect(findMatches([many], 'unity_list_commands').ids).toEqual([
			'a',
			'b',
			'c',
		]);
	});

	it('returns nothing for an empty query', () => {
		expect(findMatches(messages, '   ').ids).toEqual([]);
	});
});

describe('stepIndex', () => {
	it('cycles in both directions', () => {
		expect(stepIndex(0, 3, 1)).toBe(1);
		expect(stepIndex(2, 3, 1)).toBe(0);
		expect(stepIndex(0, 3, -1)).toBe(2);
	});

	it('stays put when there is nothing to step through', () => {
		expect(stepIndex(0, 0, 1)).toBe(0);
	});
});
