import { describe, expect, it } from 'vitest';
import {
	attachmentPrompt,
	displayedUserMessage,
} from '../../src/attachments/attachment-message';

describe('attachment messages', () => {
	it('keeps paths for the agent but hides them from the transcript', () => {
		const prompt = attachmentPrompt('Inspect this', [
			{
				name: 'reference.png',
				mimeType: 'image/png',
				size: 3,
				path: '/private/session/reference.png',
			},
		]);

		expect(prompt).toContain('/private/session/reference.png');
		expect(
			displayedUserMessage([
				{ type: 'text', text: prompt },
				{ type: 'image', mimeType: 'image/png', data: 'YWJj' },
			]),
		).toEqual({
			text: 'Inspect this',
			attachments: [
				{
					id: 'reference.png',
					name: 'reference.png',
					mimeType: 'image/png',
					size: 3,
					data: 'YWJj',
				},
			],
		});
	});

	it('leaves ordinary messages untouched', () => {
		expect(displayedUserMessage('hello')).toEqual({
			text: 'hello',
			attachments: [],
		});
	});
});
