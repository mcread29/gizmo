import type { ConversationMessage } from '@unity-agent/protocol';
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ConversationMessageView from './ConversationMessage.svelte';

describe('ConversationMessage', () => {
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
		const { container, getByRole, getByText } = render(
			ConversationMessageView,
			{ message, agentName: 'Unity Agent' },
		);

		expect(getByRole('heading', { name: 'Result' })).toBeInTheDocument();
		expect(getByRole('button', { name: 'Copy response' })).toBeInTheDocument();
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
