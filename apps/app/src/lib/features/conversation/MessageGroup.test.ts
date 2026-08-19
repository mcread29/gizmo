import type { ConversationMessage } from '@unity-agent/protocol';
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MessageGroupView from './MessageGroup.svelte';
import { groupMessages } from './message-groups';

describe('MessageGroup', () => {
	it('renders attachment cards with image previews', () => {
		const message: ConversationMessage = {
			id: 'message-attachment',
			role: 'user',
			content: 'Inspect this',
			createdAt: 1,
			complete: true,
			tools: [],
			attachments: [
				{
					id: 'reference-id',
					name: 'reference.png',
					mimeType: 'image/png',
					size: 3,
					data: 'YWJj',
				},
			],
		};
		const { getByRole, getByText } = render(MessageGroupView, {
			group: {
				id: 'group-1',
				role: 'user',
				createdAt: 1,
				messages: [message],
			},
			agentName: 'Agent',
		});

		expect(getByText('reference.png')).toBeInTheDocument();
		expect(
			getByRole('button', { name: 'Preview reference.png' }),
		).toBeVisible();
	});

	it('renders Markdown, code controls, and a collapsed file diff', async () => {
		const message: ConversationMessage = {
			id: 'message-1',
			role: 'assistant',
			content: '## Result\n\n```csharp\nDebug.Log("ready");\n```',
			createdAt: 1,
			complete: true,
			tools: [
				{
					id: 'tool-1',
					name: 'edit',
					status: 'complete',
					statusText: 'Completed',
					result: { patch: '@@ -1 +1 @@\n-old\n+new' },
				},
			],
		};
		const { container, getByRole, getByText } = render(MessageGroupView, {
			group: groupMessages([message])[0]!,
			agentName: 'Gizmo',
		});

		expect(getByRole('heading', { name: 'Result' })).toBeInTheDocument();
		expect(
			container.querySelector('[data-ui="message-content"]'),
		).toContainElement(container.querySelector('[data-ui="markdown"]'));
		expect(getByRole('button', { name: 'Copy response' })).toBeInTheDocument();
		const responseCopy = getByRole('button', { name: 'Copy response' });
		const messagePart = container.querySelector('[data-ui="message-part"]')!;
		expect(
			messagePart.compareDocumentPosition(responseCopy) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(container.querySelector('[data-copy-code]')).toBeInTheDocument();
		const details = container.querySelector('details');
		expect(details).not.toHaveAttribute('open');

		await fireEvent.click(getByText('Edit file'));
		expect(details).toHaveAttribute('open');
		const added = container.querySelector(
			'[data-ui="diff-line"][data-kind="added"]',
		);
		expect(added).toHaveTextContent('new');
		expect(
			container.querySelector('[data-ui="diff-summary"]'),
		).toHaveTextContent('+1');
	});
});
