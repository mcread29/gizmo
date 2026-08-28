import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { gizmoWebExtension } from '../../../../../pi-extensions/ask-user/src/web/index.ts';
import { extension, registerWebExtensions } from './registry.svelte';
import { toolLabel } from '../features/conversation/tool-labels';

// The test setup re-registers unity before every test, replacing the
// registry; ask-user rides along the same way.
beforeEach(() => {
	if (!extension('ask-user')) registerWebExtensions([gizmoWebExtension]);
});

const answeredTool = {
	id: 'call-1',
	name: 'ask_user',
	status: 'complete' as const,
	statusText: '',
	input: {
		question: 'Which color do you prefer?',
		options: [{ label: 'Red' }, { label: 'Blue' }],
	},
	result: {
		question: 'Which color do you prefer?',
		options: ['Red', 'Blue'],
		answer: 'Blue',
		wasCustom: false,
		cancelled: false,
	},
};

describe('ask-user web extension', () => {
	it('registers at runtime and labels its tool', () => {
		expect(extension('ask-user')?.id).toBe('ask-user');
		expect(toolLabel('ask_user')).toBe('Ask the user');
		expect(gizmoWebExtension.resultFor!('ask_user')).toBeDefined();
	});

	it('renders the question, options, and the picked answer', () => {
		const Result = gizmoWebExtension.resultFor!('ask_user')!;
		render(Result, {
			tool: answeredTool,
			consoleEntries: [],
			errors: [],
		});

		expect(screen.getByText('Which color do you prefer?')).toBeInTheDocument();
		const blue = screen
			.getAllByText('Blue')
			.map((element) => element.closest('li'))
			.find(Boolean);
		expect(blue).toHaveAttribute('data-selected');
	});

	it('marks dismissed questions', () => {
		const Result = gizmoWebExtension.resultFor!('ask_user')!;
		render(Result, {
			tool: {
				...answeredTool,
				id: 'call-2',
				input: { question: 'Proceed?', options: [{ label: 'Yes' }] },
				result: {
					question: 'Proceed?',
					options: ['Yes'],
					answer: null,
					wasCustom: false,
					cancelled: true,
				},
			},
			consoleEntries: [],
			errors: [],
		});

		expect(screen.getByText(/Dismissed without an answer/)).toBeInTheDocument();
	});
});
