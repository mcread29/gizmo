import type { ConversationMessage } from '@unity-agent/protocol';
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { AgentStore } from '../../agent-client';
import MessageList from './MessageList.svelte';

describe('MessageList', () => {
	it('mounts recent history first and expands older messages on demand', async () => {
		const messages = Array.from({ length: 65 }, (_, index) => message(index));
		const store = {
			messages,
			messagesLoading: false,
			sessionState: 'idle',
			sessionId: 'session-1',
			readAttachment: async () => {
				throw new Error('No attachment');
			},
			revealAttachment: async () => {},
		} as unknown as AgentStore;
		const { container, getByRole } = render(MessageList, {
			store,
			agentName: 'Gizmo',
			autoFollowOutput: false,
			expandReasoning: false,
		});

		expect(container.querySelectorAll('[data-ui="message"]')).toHaveLength(60);
		await fireEvent.click(
			getByRole('button', { name: 'Show 5 earlier messages' }),
		);
		expect(container.querySelectorAll('[data-ui="message"]')).toHaveLength(65);
	});
});

function message(index: number): ConversationMessage {
	return {
		id: `message-${index}`,
		role: index % 2 === 0 ? 'user' : 'assistant',
		content: `Message ${index}`,
		createdAt: index * 10 * 60_000,
		complete: true,
		tools: [],
	};
}
