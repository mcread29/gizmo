import { describe, expect, it } from 'vitest';
import { formatTokens, usageView } from './usage';

const base = {
	input: 12_000,
	output: 800,
	cacheRead: 4_000,
	cacheWrite: 0,
	contextUsed: 16_800,
	cost: 0.0412,
};

describe('usageView', () => {
	it('reports the share of the window the next request needs', () => {
		const view = usageView({ ...base, contextWindow: 200_000 });
		expect(view.fraction).toBeCloseTo(0.084);
		expect(view.level).toBe('ok');
		expect(view.tokens).toBe('17k / 200k');
	});

	it('escalates as the window fills', () => {
		expect(
			usageView({ ...base, contextUsed: 160_000, contextWindow: 200_000 })
				.level,
		).toBe('warn');
		expect(
			usageView({ ...base, contextUsed: 190_000, contextWindow: 200_000 })
				.level,
		).toBe('full');
	});

	it('still reports a total when the model has no stated window', () => {
		const view = usageView(base);
		expect(view.fraction).toBeUndefined();
		expect(view.level).toBe('ok');
		expect(view.tokens).toBe('17k');
	});
});

describe('formatTokens', () => {
	it('scales the unit to the size', () => {
		expect(formatTokens(940)).toBe('940');
		expect(formatTokens(17_400)).toBe('17k');
		expect(formatTokens(1_240_000)).toBe('1.2M');
	});
});
