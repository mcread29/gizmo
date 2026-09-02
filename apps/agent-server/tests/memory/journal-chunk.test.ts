import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';
import { chunkEntries } from '../../src/memory/journal-chunk';
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

const user = (id: string, text: string) =>
	entry(id, { role: 'user', content: [{ type: 'text', text }] });

const call = (id: string, toolId: string, text = '') =>
	entry(id, {
		role: 'assistant',
		content: [
			...(text ? [{ type: 'text', text }] : []),
			{ type: 'toolCall', id: toolId, name: 'read', args: { path: id } },
		],
	});

const result = (id: string, toolId: string, text: string) =>
	entry(id, {
		role: 'toolResult',
		toolCallId: toolId,
		content: [{ type: 'text', text }],
	});

const ids = (chunks: SessionEntry[][]) =>
	chunks.map((chunk) => chunk.map(({ id }) => id));

describe('chunkEntries', () => {
	it('keeps a small span whole', () => {
		const chunks = chunkEntries([user('u1', 'a'), user('u2', 'b')]);
		expect(ids(chunks)).toEqual([['u1', 'u2']]);
	});

	it('cuts only where a user message begins a turn', () => {
		const turn = (n: number) => [
			user(`u${n}`, 'x'.repeat(300)),
			call(`a${n}`, `t${n}`),
			result(`r${n}`, `t${n}`, 'y'.repeat(300)),
		];
		const chunks = chunkEntries(
			[...turn(1), ...turn(2), ...turn(3)],
			undefined,
			1500,
		);

		expect(ids(chunks)).toEqual([
			['u1', 'a1', 'r1', 'u2', 'a2', 'r2'],
			['u3', 'a3', 'r3'],
		]);
		for (const chunk of chunks) {
			expect(normalizeSegment(chunk).body.length).toBeLessThanOrEqual(1500);
		}
	});

	/**
	 * A single agentic turn can run for hundreds of tool calls. Such a turn is
	 * cut in front of assistant messages, which is the only place inside a turn
	 * where a tool result is guaranteed not to be separated from its call.
	 */
	it('splits an oversized turn before an assistant message, never between a call and its result', () => {
		const entries = [user('u1', 'go')];
		for (let n = 1; n <= 6; n += 1) {
			entries.push(call(`a${n}`, `t${n}`, 'z'.repeat(200)));
			entries.push(result(`r${n}`, `t${n}`, 'w'.repeat(200)));
		}
		const chunks = chunkEntries(entries, undefined, 1200);

		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			const first = chunk[0];
			expect(first && (first as { id: string }).id.startsWith('r')).toBe(false);
			for (const item of chunk) {
				if (!item.id.startsWith('r')) continue;
				const callId = `a${item.id.slice(1)}`;
				expect(chunk.some(({ id }) => id === callId)).toBe(true);
			}
		}
	});

	it('never leaves a chunk empty and preserves order', () => {
		const entries = Array.from({ length: 20 }, (_, n) =>
			user(`u${n}`, 'q'.repeat(100)),
		);
		const chunks = chunkEntries(entries, undefined, 350);

		expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
		expect(chunks.flat().map(({ id }) => id)).toEqual(
			entries.map(({ id }) => id),
		);
	});
});
