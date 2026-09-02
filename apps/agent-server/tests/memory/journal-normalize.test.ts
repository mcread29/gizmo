import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';
import { normalizeSegment } from '../../src/memory/journal-normalize';

function entry(id: string, message: unknown): SessionEntry {
	return {
		type: 'message',
		id,
		parentId: null,
		timestamp: new Date().toISOString(),
		message,
	} as SessionEntry;
}

describe('normalizeSegment', () => {
	it('keeps user and assistant prose whole', () => {
		const prose = 'x'.repeat(5000);
		const { body, messages } = normalizeSegment([
			entry('e1', { role: 'user', content: [{ type: 'text', text: prose }] }),
			entry('e2', {
				role: 'assistant',
				content: [{ type: 'text', text: prose }],
			}),
		]);

		expect(messages).toBe(2);
		expect(body).toContain(prose);
		expect(body).not.toContain('truncated');
	});

	it('trims successful tool output but keeps errors whole', () => {
		const output = 'y'.repeat(4000);
		const { body } = normalizeSegment([
			entry('e1', {
				role: 'assistant',
				content: [
					{
						type: 'toolCall',
						id: 't1',
						name: 'read_file',
						args: { path: 'a' },
					},
					{ type: 'toolCall', id: 't2', name: 'run_script', args: {} },
				],
			}),
			entry('e2', {
				role: 'toolResult',
				toolCallId: 't1',
				content: [{ type: 'text', text: output }],
			}),
			entry('e3', {
				role: 'toolResult',
				toolCallId: 't2',
				isError: true,
				content: [{ type: 'text', text: output }],
			}),
		]);

		expect(body).toContain('#### read_file → ok');
		expect(body).toContain('truncated');
		expect(body).toContain('#### run_script → error');
		expect(body).toContain(output);
	});

	it('names tool results by the call they answer', () => {
		const { body } = normalizeSegment([
			entry('e1', {
				role: 'assistant',
				content: [{ type: 'toolCall', id: 't1', name: 'grep', args: {} }],
			}),
			entry('e2', {
				role: 'toolResult',
				toolCallId: 't1',
				content: [{ type: 'text', text: 'match' }],
			}),
		]);

		expect(body).toContain('### tool grep');
		expect(body).toContain('#### grep → ok');
	});

	it('skips entries that are not messages', () => {
		const { body, messages } = normalizeSegment([
			{
				type: 'model_change',
				id: 'm1',
				parentId: null,
				timestamp: new Date().toISOString(),
				provider: 'anthropic',
				modelId: 'claude-opus-5',
			} as SessionEntry,
		]);

		expect(messages).toBe(0);
		expect(body).toBe('');
	});
});
