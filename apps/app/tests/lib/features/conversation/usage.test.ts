import { describe, expect, it } from 'vitest';
import {
	formatTokens,
	usageView,
} from '../../../../src/lib/features/conversation/usage';

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
		expect(view.percent).toBeCloseTo(8.4);
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

	it('reads the meter against the auto-compaction threshold when one is set', () => {
		const policy = { enabled: true, fillPercent: 25, retainPercent: 10 };
		const at = (contextUsed: number) =>
			usageView({ ...base, contextUsed, contextWindow: 200_000 }, policy);

		// 16% of the window is well under the model's wall, but four fifths of
		// the way to a 25% threshold.
		expect(at(30_000).level).toBe('ok');
		expect(at(42_000).level).toBe('warn');
		expect(at(50_000).level).toBe('full');
		expect(at(42_000).threshold).toBeCloseTo(0.25);
		expect(at(42_000).policy).toBe('Auto-compacts at 25% (50k)');
	});

	it('falls back to the model wall when auto-compaction is off', () => {
		const policy = { enabled: false, fillPercent: 25, retainPercent: 10 };
		const view = usageView(
			{ ...base, contextUsed: 60_000, contextWindow: 200_000 },
			policy,
		);
		expect(view.level).toBe('ok');
		expect(view.threshold).toBeUndefined();
		expect(view.policy).toBe('Auto-compaction is off');
	});

	it('still reports a total when the model has no stated window', () => {
		const view = usageView(base);
		expect(view.fraction).toBeUndefined();
		expect(view.percent).toBeUndefined();
		expect(view.level).toBe('ok');
		expect(view.tokens).toBe('17k');
	});

	it('treats a zero context as no usage reported yet', () => {
		const view = usageView({ ...base, contextUsed: 0, contextWindow: 200_000 });
		expect(view.fraction).toBeUndefined();
		expect(view.percent).toBeUndefined();
		expect(view.level).toBe('ok');
		expect(view.tokens).toBe('– / 200k');
		expect(view.detail).toContain('Waiting');
	});
});

describe('formatTokens', () => {
	it('scales the unit to the size', () => {
		expect(formatTokens(940)).toBe('940');
		expect(formatTokens(17_400)).toBe('17k');
		expect(formatTokens(1_240_000)).toBe('1.2M');
	});
});
