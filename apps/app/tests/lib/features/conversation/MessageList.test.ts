import type { ConversationMessage } from '@gizmo/protocol';
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { AgentStore } from '../../../../src/lib/agent-client';
import MessageList from '../../../../src/lib/features/conversation/MessageList.svelte';

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

		const canvas = container.querySelector<HTMLElement>(
			'[data-ui="virtual-canvas"]',
		);
		expect(canvas?.style.height).toBe('22000px');
		expect(
			container.querySelector('[data-ui="scroll-anchor"]'),
		).not.toBeInTheDocument();
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
