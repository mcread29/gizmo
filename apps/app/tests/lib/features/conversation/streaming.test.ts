import type { ConversationMessage } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import {
	formatElapsed,
	streamingActivity,
} from '../../../../src/lib/features/conversation/streaming';

function assistant(tools: ConversationMessage['tools'] = []) {
	return {
		id: 'm1',
		role: 'assistant' as const,
		content: '',
		createdAt: 1_000,
		complete: false,
		tools,
	};
}

describe('streamingActivity', () => {
	it('names the tool that is running rather than the generic state', () => {
		const activity = streamingActivity(
			[
				assistant([
					{
						id: 't1',
						name: 'unity_wait_for_compile',
						status: 'complete',
						statusText: 'Completed',
					},
					{
						id: 't2',
						name: 'unity_test',
						status: 'running',
						statusText: 'Running',
					},
				]),
			],
			'streaming',
		);

		expect(activity).toMatchObject({
			streaming: true,
			label: 'unity_test',
			startedAt: 1_000,
		});
	});

	it('separates thinking from responding by whether text has arrived', () => {
		expect(streamingActivity([assistant()], 'streaming').label).toBe(
			'Thinking',
		);
		expect(
			streamingActivity([{ ...assistant(), content: 'Sure' }], 'streaming')
				.label,
		).toBe('Responding');
	});

	it('reports nothing streaming while idle', () => {
		expect(streamingActivity([assistant()], 'idle')).toEqual({
			streaming: false,
			label: 'Idle',
		});
	});
});

describe('formatElapsed', () => {
	it('switches to minutes once a run gets long', () => {
		expect(formatElapsed(4_400)).toBe('4s');
		expect(formatElapsed(65_000)).toBe('1m 05s');
	});

	it('keeps a running turn visible when an extension hides its own message', () => {
		const messages = [
			{
				id: 'a1',
				role: 'assistant' as const,
				content: 'partial',
				createdAt: 0,
				complete: false,
				tools: [],
			},
		];
		const shown = streamingActivity(messages, 'streaming', {
			message: 'Deploying',
			visible: false,
		});
		expect(shown.streaming).toBe(true);
		expect(shown.label).toBe('Responding');
	});
});
