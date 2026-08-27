import { describe, expect, it, vi } from 'vitest';
import type { PiExtensionUiRuntime } from '../../src/sessions/pi-extension-ui-runtime';
import { createAskUserTool } from '../../src/tools/ask-user-tool';

interface StubContext {
	select: ReturnType<typeof vi.fn>;
	input: ReturnType<typeof vi.fn>;
}

function stubUi(stub: StubContext) {
	return { context: stub } as unknown as PiExtensionUiRuntime;
}

function run(
	tool: ReturnType<typeof createAskUserTool>,
	params: { question: string; options?: string[] },
) {
	// The full pi execute signature carries an ExtensionContext the tool
	// never reads; call it with the three arguments that matter.
	const execute = tool.execute as unknown as (
		id: string,
		params: unknown,
		signal?: AbortSignal,
	) => Promise<{
		content: { text: string }[];
		details: unknown;
	}>;
	return execute('call-1', params, new AbortController().signal);
}

describe('ask_user tool', () => {
	it('returns the picked option for a multiple-choice question', async () => {
		const select = vi.fn().mockResolvedValue('Blue');
		const tool = createAskUserTool(stubUi({ select, input: vi.fn() }));

		const result = await run(tool, {
			question: 'Favorite color?',
			options: ['Red', 'Blue'],
		});

		expect(select).toHaveBeenCalledWith(
			'Favorite color?',
			['Red', 'Blue', 'Write my own answer…'],
			{ signal: expect.anything() },
		);
		expect(result.content[0]!.text).toBe('Blue');
	});

	it('offers a free-text escape hatch that becomes a follow-up input', async () => {
		const input = vi.fn().mockResolvedValue('Teal, mostly');
		const select = vi.fn().mockResolvedValue('Write my own answer…');
		const tool = createAskUserTool(stubUi({ select, input }));

		const result = await run(tool, {
			question: 'Favorite color?',
			options: ['Red', 'Blue'],
		});

		// The sentinel is appended to the offered options, and picking it asks
		// for the answer with a second request.
		expect(select.mock.calls[0]![1]).toEqual([
			'Red',
			'Blue',
			'Write my own answer…',
		]);
		expect(input).toHaveBeenCalledWith('Favorite color?', 'Type your answer…', {
			signal: expect.any(AbortSignal),
		});
		expect(result.content[0]!.text).toBe('Teal, mostly');
	});

	it('asks for free text directly when no options are given', async () => {
		const input = vi.fn().mockResolvedValue('Tuesday works');
		const tool = createAskUserTool(stubUi({ select: vi.fn(), input }));

		const result = await run(tool, { question: 'When should we ship?' });

		expect(input).toHaveBeenCalledWith(
			'When should we ship?',
			'Type your answer…',
			{
				signal: expect.any(AbortSignal),
			},
		);
		expect(result.content[0]!.text).toBe('Tuesday works');
	});

	it('reports an unanswered question when the dialog is dismissed', async () => {
		const select = vi.fn().mockResolvedValue(undefined);
		const tool = createAskUserTool(stubUi({ select, input: vi.fn() }));

		const result = await run(tool, {
			question: 'Proceed?',
			options: ['Yes', 'No'],
		});

		expect(result.content[0]!.text).toContain('did not answer');
	});
});
