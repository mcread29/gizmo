import { describe, expect, it } from 'vitest';
import { readModelSetting } from '../src/ui';

describe('readModelSetting', () => {
	it('reads a provider and id', () => {
		expect(readModelSetting({ provider: 'anthropic', id: 'opus' })).toEqual({
			provider: 'anthropic',
			id: 'opus',
		});
	});

	it('keeps a thinking level when one is stored', () => {
		expect(
			readModelSetting({
				provider: 'anthropic',
				id: 'opus',
				thinkingLevel: 'high',
			}),
		).toEqual({ provider: 'anthropic', id: 'opus', thinkingLevel: 'high' });
	});

	it('drops a thinking level that is not a non-empty string', () => {
		expect(
			readModelSetting({ provider: 'a', id: 'b', thinkingLevel: 7 }),
		).toEqual({ provider: 'a', id: 'b' });
	});

	it('returns undefined for anything that is not a model', () => {
		for (const value of [
			undefined,
			null,
			'anthropic/opus',
			42,
			{},
			{ provider: 'a' },
			{ id: 'b' },
			{ provider: '', id: 'b' },
			{ provider: 'a', id: 1 },
		]) {
			expect(readModelSetting(value)).toBeUndefined();
		}
	});
});
