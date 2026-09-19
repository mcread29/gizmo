import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { readDisplayResult, type DisplayInput } from '@gizmo/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createDisplayTool } from '../../src/pi-extensions/display';
import { normalizeToolResult } from '../../src/tools/tool-result';

const spec = {
	root: 'r',
	elements: { r: { type: 'Text' as const, props: { text: 'Report' } } },
};
const input: DisplayInput = {
	kind: 'text',
	prompt: 'Name?',
	placeholder: 'Name',
};
function context(hasUI = true) {
	const ui = {
		input: vi.fn<ExtensionContext['ui']['input']>().mockResolvedValue('answer'),
		select: vi.fn<ExtensionContext['ui']['select']>().mockResolvedValue('A'),
		confirm: vi.fn<ExtensionContext['ui']['confirm']>().mockResolvedValue(true),
	};
	// This tool uses only hasUI and the three dialog methods.
	return { ui, ctx: { hasUI, ui } as unknown as ExtensionContext };
}
const execute = createDisplayTool().execute;

const specOf = (envelope: ReturnType<typeof readDisplayResult>) =>
	envelope && 'spec' in envelope ? envelope.spec : undefined;

describe('display tool', () => {
	it('completes immediately without input, including in headless mode', async () => {
		const { ctx, ui } = context(false);
		const update = vi.fn();
		const result = await execute(
			'id',
			{ spec, title: 'Report' },
			undefined,
			update,
			ctx,
		);
		expect(result.details).toEqual({
			gizmoDisplay: { version: 1, title: 'Report', spec },
		});
		expect(update).not.toHaveBeenCalled();
		expect(ui.input).not.toHaveBeenCalled();
		expect(readDisplayResult(normalizeToolResult(result))).toEqual({
			version: 1,
			title: 'Report',
			spec,
		});
	});

	it('publishes before prompting and stays pending until the UI resolves', async () => {
		const { ctx, ui } = context();
		let resolveInput!: (value: string | undefined) => void;
		const dialog = new Promise<string | undefined>((resolve) => {
			resolveInput = resolve;
		});
		const update = vi.fn();
		ui.input.mockImplementation(() => {
			expect(update).toHaveBeenCalledOnce();
			return dialog;
		});
		const controller = new AbortController();
		let settled = false;
		const pending = execute(
			'id',
			{ spec, input },
			controller.signal,
			update,
			ctx,
		).then((value) => {
			settled = true;
			return value;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		expect(
			specOf(readDisplayResult(normalizeToolResult(update.mock.calls[0]?.[0]))),
		).toEqual(spec);
		expect(ui.input).toHaveBeenCalledWith('Name?', 'Name', {
			signal: controller.signal,
		});
		resolveInput('Ada');
		const result = await pending;
		expect(result.details).toMatchObject({
			response: {
				status: 'submitted',
				value: 'Ada',
			},
		});
		expect(result.content).toEqual([
			{
				type: 'text',
				text: 'Display input response: {"status":"submitted","value":"Ada"}',
			},
		]);
		expect(specOf(readDisplayResult(normalizeToolResult(result)))).toEqual(spec);
	});

	it.each([true, false])(
		'returns confirm %s as submitted (false includes dismissal)',
		async (value) => {
			const { ctx, ui } = context();
			ui.confirm.mockResolvedValue(value);
			const result = await execute(
				'id',
				{
					spec,
					input: { kind: 'confirm', prompt: 'Continue?', message: 'Proceed?' },
				},
				undefined,
				undefined,
				ctx,
			);
			expect(result.details?.response).toEqual({ status: 'submitted', value });
			expect(result.content[0]).toMatchObject({
				text: expect.stringContaining(String(value)),
			});
		},
	);

	it('uses select and validates its returned option', async () => {
		const { ctx, ui } = context();
		const params = {
			spec,
			input: { kind: 'select' as const, prompt: 'Pick', options: ['A', 'B'] },
		};
		const result = await execute('id', params, undefined, undefined, ctx);
		expect(result.details?.response).toEqual({
			status: 'submitted',
			value: 'A',
		});
		ui.select.mockResolvedValue('C');
		await expect(
			execute('id', params, undefined, undefined, ctx),
		).rejects.toThrow('not a listed option');
	});

	it('preserves empty text and distinguishes it from dismissal', async () => {
		const { ctx, ui } = context();
		ui.input.mockResolvedValue('');
		expect(
			(await execute('id', { spec, input }, undefined, undefined, ctx)).details
				?.response,
		).toEqual({ status: 'submitted', value: '' });
		ui.input.mockResolvedValue(undefined);
		const cancelled = await execute(
			'id',
			{ spec, input },
			undefined,
			undefined,
			ctx,
		);
		expect(cancelled.details?.response).toEqual({ status: 'cancelled' });
		expect(cancelled.content[0]).toMatchObject({
			text: expect.stringContaining('cancelled'),
		});
	});

	it('aborts a pending non-cooperative UI and retains the display', async () => {
		const { ctx, ui } = context();
		ui.input.mockReturnValue(new Promise(() => {}));
		const controller = new AbortController();
		const pending = execute(
			'id',
			{ spec, input },
			controller.signal,
			vi.fn(),
			ctx,
		);
		controller.abort();
		const result = await pending;
		expect(result.details).toMatchObject({ response: { status: 'cancelled' } });
		expect(specOf(readDisplayResult(normalizeToolResult(result)))).toEqual(spec);
	});

	it('does not open an already-aborted dialog', async () => {
		const { ctx, ui } = context();
		const result = await execute(
			'id',
			{ spec, input },
			AbortSignal.abort(),
			undefined,
			ctx,
		);
		expect(result.details?.response).toEqual({ status: 'cancelled' });
		expect(ui.input).not.toHaveBeenCalled();
	});

	it('rejects input in headless mode without opening any dialog', async () => {
		const { ctx, ui } = context(false);
		await expect(
			execute('id', { spec, input }, undefined, undefined, ctx),
		).rejects.toThrow('requires an interactive UI');
		expect(ui.input).not.toHaveBeenCalled();
	});

	it('revalidates parameters before publishing or asking for input', async () => {
		const { ctx, ui } = context();
		const update = vi.fn();
		await expect(
			execute(
				'id',
				{ spec: { ...spec, root: 'missing' }, input },
				undefined,
				update,
				ctx,
			),
		).rejects.toThrow('Invalid display');
		await expect(
			execute(
				'id',
				{ spec, input: { kind: 'select', prompt: 'Pick', options: [] } },
				undefined,
				update,
				ctx,
			),
		).rejects.toThrow('Invalid display');
		expect(update).not.toHaveBeenCalled();
		expect(ui.input).not.toHaveBeenCalled();
	});
});
