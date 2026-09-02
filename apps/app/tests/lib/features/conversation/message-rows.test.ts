import type { ConversationMessage } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import {
	createMessageRows,
	estimateRowHeight,
} from '../../../../src/lib/features/conversation/message-rows';

describe('estimateRowHeight', () => {
	it('scales with the length of the message', () => {
		const [short] = createMessageRows([message('Hi')]);
		const [long] = createMessageRows([message('word '.repeat(400))]);

		// A single constant estimate was placing long rows thousands of pixels
		// away from where they measure, which left a long transcript scrolled
		// past its own content onto blank space.
		expect(estimateRowHeight(long!)).toBeGreaterThan(
			estimateRowHeight(short!) * 5,
		);
	});

	it('counts reasoning toward the estimate', () => {
		const [plain] = createMessageRows([message('Answer')]);
		const [reasoned] = createMessageRows([
			{ ...message('Answer'), reasoning: 'thought '.repeat(200) },
		]);

		expect(estimateRowHeight(reasoned!)).toBeGreaterThan(
			estimateRowHeight(plain!),
		);
	});

	it('estimates a collapsed tool row as a single line', () => {
		const rows = createMessageRows([
			{
				...message('Running'),
				tools: [
					{
						id: 'tool-1',
						name: 'read',
						status: 'complete',
						statusText: 'Read a file',
					},
				],
			},
		]);
		const toolRow = rows.find((row) => row.kind === 'tool');

		expect(toolRow).toBeDefined();
		expect(estimateRowHeight(toolRow!)).toBeLessThan(80);
	});

	it('caps a pathological paste so it cannot dwarf the transcript', () => {
		const [huge] = createMessageRows([message('x'.repeat(2_000_000))]);

		expect(estimateRowHeight(huge!)).toBe(6000);
	});
});

function message(content: string): ConversationMessage {
	return {
		id: `message-${content.length}`,
		role: 'assistant',
		content,
		createdAt: 0,
		complete: true,
		tools: [],
	};
}
