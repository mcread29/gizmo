import { beforeEach, describe, expect, it, vi } from 'vitest';

const getModel = vi.fn();
const getAvailable = vi.fn();
const completeSimple = vi.fn();

vi.mock('../../src/sessions/pi-model-runtime', () => ({
	gizmoModelRuntime: async () => ({ getModel, getAvailable, completeSimple }),
}));

const { completeText, globalModelCatalog } =
	await import('../../src/sessions/model-completion');

const model = { provider: 'anthropic', id: 'opus', name: 'Opus' };
const text = (value: string) => ({
	stopReason: 'stop',
	content: [{ type: 'text', text: value }],
});

beforeEach(() => {
	vi.clearAllMocks();
	// A directory with no settings.json, so the default model is the first one.
	process.env.PI_CODING_AGENT_DIR = '/nonexistent-gizmo-test';
	getModel.mockReturnValue(model);
	getAvailable.mockResolvedValue([
		{ ...model, reasoning: true, contextWindow: 200 },
	]);
	completeSimple.mockResolvedValue(text('  a message  '));
});

describe('completeText', () => {
	it('completes with the model a setting names and its thinking level', async () => {
		expect(
			await completeText({
				model: { provider: 'anthropic', id: 'opus', thinkingLevel: 'high' },
				systemPrompt: 'be brief',
				prompt: 'hello',
				maxTokens: 10,
			}),
		).toBe('a message');
		expect(getModel).toHaveBeenCalledWith('anthropic', 'opus');
		const [, context, options] = completeSimple.mock.calls[0]!;
		expect(context.systemPrompt).toBe('be brief');
		expect(context.messages[0].content).toBe('hello');
		expect(options.maxTokens).toBe(10);
		expect(options.reasoning).toBe('high');
	});

	it('falls back to the first available model when none is named', async () => {
		await completeText({ prompt: 'hello' });
		expect(getModel).not.toHaveBeenCalled();
		expect(completeSimple).toHaveBeenCalled();
	});

	it('reports a model that is not installed', async () => {
		getModel.mockReturnValue(undefined);
		await expect(
			completeText({ model: { provider: 'x', id: 'y' }, prompt: 'hi' }),
		).rejects.toThrow(/Unknown model: x\/y/);
	});

	it('surfaces a provider error and an empty answer', async () => {
		completeSimple.mockResolvedValue({
			stopReason: 'error',
			errorMessage: 'no credit',
			content: [],
		});
		await expect(completeText({ prompt: 'hi' })).rejects.toThrow('no credit');
		completeSimple.mockResolvedValue(text('   '));
		await expect(completeText({ prompt: 'hi' })).rejects.toThrow(/no text/);
	});
});

describe('globalModelCatalog', () => {
	it('lists available models with every thinking level', async () => {
		const catalog = await globalModelCatalog();
		expect(catalog.models).toEqual([
			{
				provider: 'anthropic',
				id: 'opus',
				name: 'Opus',
				reasoning: true,
				contextWindow: 200,
			},
		]);
		expect(catalog.thinkingLevels).toContain('off');
		expect(catalog.thinkingLevels).toContain('max');
	});
});
