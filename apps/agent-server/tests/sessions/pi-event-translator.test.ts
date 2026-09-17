import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';
import { parseAgentEvent, protocolVersion } from '@gizmo/protocol';
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
	it.each([
		{ content: [{ type: 'text', text: 'Working' }] },
		{ content: [{ type: 'text', text: 'Working' }], details: undefined },
	])('keeps text-only updates free of result: %j', (partialResult) => {
		const events: TranslatedPiEvent[] = [];
		const translator = new PiEventTranslator((translated) =>
			events.push(translated),
		);
		translator.receive(
			event({
				type: 'tool_execution_update',
				toolCallId: 'tool-1',
				partialResult,
			}),
		);
		expect(events).toEqual([
			{ type: 'tool.updated', toolCallId: 'tool-1', message: 'Working' },
		]);
	});

	it('normalizes partial details through the wire event schema', () => {
		const events: TranslatedPiEvent[] = [];
		const translator = new PiEventTranslator((translated) =>
			events.push(translated),
		);
		const details = {
			gizmoDisplay: { state: 'waiting', title: 'Choose' },
			omitted: undefined,
		};
		translator.receive(
			event({
				type: 'tool_execution_update',
				toolCallId: 'tool-1',
				toolName: 'display',
				partialResult: { content: [], details },
			}),
		);
		const wireEvent = parseAgentEvent(
			JSON.parse(
				JSON.stringify({
					protocolVersion,
					sessionId: 'session-1',
					eventId: 1,
					...events[0],
				}),
			),
		);
		expect(wireEvent).toMatchObject({
			type: 'tool.updated',
			message: 'Running',
			result: { gizmoDisplay: { state: 'waiting', title: 'Choose' } },
		});
		if (events[0]?.type === 'tool.updated') {
			expect(events[0].result).not.toBe(details);
			expect(events[0].result).not.toHaveProperty('omitted');
		}
	});

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

	it('drops whitespace-only thinking until real text arrives', () => {
		expect(
			reasoningOf([
				{ type: 'thinking_start', contentIndex: 0 },
				{ type: 'thinking_delta', contentIndex: 0, delta: '\n' },
				{ type: 'thinking_delta', contentIndex: 0, delta: '  ' },
				{ type: 'thinking_delta', contentIndex: 0, delta: 'real' },
				{ type: 'thinking_delta', contentIndex: 0, delta: '\n' },
			]),
		).toEqual([
			{ type: 'message.reasoning', messageId: 'message-1', delta: 'real' },
			{ type: 'message.reasoning', messageId: 'message-1', delta: '\n' },
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
				result: { summary: 'Earlier work', tokensBefore: 90_000 },
				aborted: false,
				willRetry: false,
			}),
		);

		expect(events).toEqual([
			{ type: 'session.compaction', active: true, reason: 'threshold' },
			{
				type: 'session.compaction',
				active: false,
				reason: 'threshold',
				result: { summary: 'Earlier work', tokensBefore: 90_000 },
			},
		]);
	});

	it('reports a forced post-run compaction under the threshold reason', () => {
		const events: TranslatedPiEvent[] = [];
		const translator = new PiEventTranslator((translated) =>
			events.push(translated),
		);

		translator.expectThresholdCompaction();
		translator.receive(event({ type: 'compaction_start', reason: 'manual' }));
		translator.receive(
			event({
				type: 'compaction_end',
				reason: 'manual',
				result: undefined,
				aborted: true,
				willRetry: false,
			}),
		);
		translator.receive(event({ type: 'compaction_start', reason: 'manual' }));

		expect(events.map((item) => 'reason' in item && item.reason)).toEqual([
			'threshold',
			'threshold',
			'manual',
		]);
	});

	it('forwards the queue so the thread can show what is still waiting', () => {
		const events: TranslatedPiEvent[] = [];
		const translator = new PiEventTranslator((e) => events.push(e));
		translator.receive(
			event({ type: 'queue_update', steering: ['Go faster'], followUp: [] }),
		);
		expect(events).toEqual([
			{ type: 'session.queue', steering: ['Go faster'], followUp: [] },
		]);
	});
});

describe('PiEventTranslator interrupted turns', () => {
	function completionFor(stopReason: string): TranslatedPiEvent | undefined {
		const events: TranslatedPiEvent[] = [];
		const translator = new PiEventTranslator((translated) =>
			events.push(translated),
		);
		const message = {
			role: 'assistant',
			content: [],
			timestamp: 1,
			stopReason,
		};
		translator.receive(event({ type: 'message_start', message }));
		translator.receive(event({ type: 'message_end', message }));
		return events.find((emitted) => emitted.type === 'message.completed');
	}

	/** The client has no other signal that the run stopped rather than finished. */
	it('flags a turn the provider aborted', () => {
		expect(completionFor('aborted')).toMatchObject({ interrupted: true });
	});

	it('leaves a turn that stopped normally unflagged', () => {
		expect(completionFor('stop')).not.toHaveProperty('interrupted');
	});
});
