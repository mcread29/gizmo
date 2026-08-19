import type { ConversationMessage } from '@unity-agent/protocol';
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { AgentStore } from '../../agent-client';
import MessageList from './MessageList.svelte';

describe('MessageList', () => {
	it('mounts only a viewport-sized window from a long transcript', async () => {
		const messages = Array.from({ length: 100 }, (_, index) => message(index));
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
		const { container, findByText } = render(MessageList, {
			store,
			agentName: 'Gizmo',
			autoFollowOutput: false,
			expandReasoning: false,
		});

		expect(
			container.querySelectorAll('[data-ui="message"]').length,
		).toBeLessThan(20);
		expect(await findByText('Message 99')).toBeInTheDocument();
	});
});

function message(index: number): ConversationMessage {
	return {
		id: `message-${index}`,
		role: 'assistant',
		content: `Message ${index}`,
		createdAt: index * 1_000,
		complete: true,
		tools: [],
	};
}
