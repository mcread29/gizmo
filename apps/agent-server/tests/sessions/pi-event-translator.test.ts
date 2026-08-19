import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';
import {
	PiEventTranslator,
	type TranslatedPiEvent,
} from '../../src/sessions/pi-event-translator';

function event(value: unknown): AgentSessionEvent {
	return value as AgentSessionEvent;
}

function translate(result: unknown, isError = false): TranslatedPiEvent {
	const events: TranslatedPiEvent[] = [];
	const translator = new PiEventTranslator((translated) =>
		events.push(translated),
	);
	translator.receive(
		event({
			type: 'tool_execution_end',
			toolCallId: 'tool-1',
			toolName: 'read',
			result,
			isError,
		}),
	);
	return events[0]!;
}

describe('PiEventTranslator tool results', () => {
	it('falls back to text when details is undefined', () => {
		expect(
			translate({
				content: [{ type: 'text', text: 'file contents' }],
				details: undefined,
			}),
		).toMatchObject({
			type: 'tool.completed',
			result: 'file contents',
			isError: false,
		});
	});

	it('uses an explicit label for a successful tool with no output', () => {
		expect(translate({ content: [], details: undefined })).toMatchObject({
			type: 'tool.completed',
			result: 'No output',
			isError: false,
		});
	});

	it('marks a failed Unity result as an error', () => {
		expect(
			translate({
				content: [{ type: 'text', text: 'COMMAND_FAILED: Bad command' }],
				details: {
					ok: false,
					errors: [{ code: 'COMMAND_FAILED', message: 'Bad command' }],
				},
			}),
		).toMatchObject({
			type: 'tool.completed',
			result: {
				ok: false,
				errors: [{ code: 'COMMAND_FAILED', message: 'Bad command' }],
			},
			isError: true,
		});
	});
});

function reasoningOf(updates: unknown[]): TranslatedPiEvent[] {
	const events: TranslatedPiEvent[] = [];
	const translator = new PiEventTranslator((translated) =>
		events.push(translated),
	);
	translator.receive(
		event({
			type: 'message_start',
			message: { role: 'assistant', content: [], timestamp: 1 },
		}),
	);
	for (const assistantMessageEvent of updates) {
		translator.receive(
			event({ type: 'message_update', assistantMessageEvent }),
		);
	}
	return events.filter((item) => item.type === 'message.reasoning');
}

describe('PiEventTranslator reasoning', () => {
	it('forwards thinking deltas and separates consecutive blocks', () => {
		expect(
			reasoningOf([
				{ type: 'thinking_start', contentIndex: 0 },
				{ type: 'thinking_delta', contentIndex: 0, delta: 'first' },
				{ type: 'thinking_start', contentIndex: 1 },
				{ type: 'thinking_delta', contentIndex: 1, delta: 'second' },
			]),
		).toEqual([
			{ type: 'message.reasoning', messageId: 'message-1', delta: 'first' },
			{ type: 'message.reasoning', messageId: 'message-1', delta: '\n\n' },
			{ type: 'message.reasoning', messageId: 'message-1', delta: 'second' },
		]);
	});

	it('reports a redacted block so the empty result is not read as a bug', () => {
		expect(
			reasoningOf([
				{
					type: 'thinking_end',
					contentIndex: 0,
					content: '',
					partial: {
						content: [{ type: 'thinking', thinking: '', redacted: true }],
					},
				},
			]),
		).toEqual([
			{
				type: 'message.reasoning',
				messageId: 'message-1',
				delta: '',
				redacted: true,
			},
		]);
	});
});

describe('PiEventTranslator compaction', () => {
	it('exposes automatic compaction progress', () => {
		const events: TranslatedPiEvent[] = [];
		const translator = new PiEventTranslator((translated) =>
			events.push(translated),
		);

		translator.receive(
			event({ type: 'compaction_start', reason: 'threshold' }),
		);
		translator.receive(
			event({
				type: 'compaction_end',
				reason: 'threshold',
				result: {},
				aborted: false,
				willRetry: false,
			}),
		);

		expect(events).toEqual([
			{ type: 'session.compaction', active: true, reason: 'threshold' },
			{ type: 'session.compaction', active: false, reason: 'threshold' },
		]);
	});
});
