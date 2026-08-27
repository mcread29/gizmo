import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { ToolCallView } from '@gizmo/protocol';
import { extension } from './registry.svelte';
import { toolLabel } from '../features/conversation/tool-labels';

describe('ask-user web extension', () => {
	it('is installed with the app and labels its tool', () => {
		expect(extension('ask-user')).toBeDefined();
		expect(toolLabel('ask_user')).toBe('Ask the user');
	});

	it('renders the question, options, and the picked answer', () => {
		const tool = {
			id: 'call-1',
			name: 'ask_user',
			status: 'complete',
			statusText: '',
			input: {
				question: 'Which color do you prefer?',
				options: [
					{ label: 'Red' },
					{ label: 'Blue' },
					{ label: 'Teal, mostly' },
				],
			},
			result: {
				question: 'Which color do you prefer?',
				options: ['Red', 'Blue', 'Teal, mostly'],
				answer: 'Teal, mostly',
				wasCustom: true,
				cancelled: false,
			},
		} as unknown as ToolCallView;

		const Result = extension('ask-user')!.resultFor!('ask_user')!;
		render(Result, { tool, consoleEntries: [], errors: [] });

		expect(screen.getByText('Which color do you prefer?')).toBeInTheDocument();
		const answer = screen.getByText('Teal, mostly', {
			selector: "[data-ui='ask-user-answer']",
		});
		expect(answer).toHaveAttribute('data-custom');
	});
});
