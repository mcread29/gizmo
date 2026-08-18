import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';
import {
	PiEventTranslator,
	type TranslatedPiEvent,
} from './pi-event-translator';

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
