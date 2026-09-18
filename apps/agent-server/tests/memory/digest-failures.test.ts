import { describe, expect, it } from 'vitest';
import {
	backfillDigests,
	generateDigest,
} from '../../src/memory/digest-generator';

/**
 * A run where every segment fails used to be silent: the reason was caught
 * and discarded, so a wrong model setting looked exactly like a model with
 * nothing to say. These pin the reason to the surface.
 */
describe('failure reporting', () => {
	const model = { provider: 'p', id: 'm' };

	it('reports why a completion failed', async () => {
		const reasons: string[] = [];
		const digest = await generateDigest(
			'0001',
			'body',
			model,
			async () => {
				throw new Error('No such model: p/m');
			},
			undefined,
			(reason) => reasons.push(reason),
		);
		expect(digest).toBeUndefined();
		expect(reasons).toEqual(['No such model: p/m']);
	});

	it('reports an answer that is not a digest', async () => {
		const reasons: string[] = [];
		await generateDigest(
			'0001',
			'body',
			model,
			async () => 'I am afraid I cannot do that',
			undefined,
			(reason) => reasons.push(reason),
		);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain('did not answer with a digest');
	});

	it('carries the last failure out of a backfill that digested nothing', async () => {
		const result = await backfillDigests(
			{
				listSegments: async () => ['0001', '0002'],
				readSegment: async () => 'body',
				digestedSegments: async () => [],
				writeDigest: async () => {},
			},
			model,
			async () => {
				throw new Error('No such model: p/m');
			},
		);
		expect(result.digested).toBe(0);
		expect(result.failed).toBe(2);
		expect(result.error).toBe('No such model: p/m');
	});

	it('leaves the reason absent when everything succeeded', async () => {
		const result = await backfillDigests(
			{
				listSegments: async () => ['0001'],
				readSegment: async () => 'body',
				digestedSegments: async () => [],
				writeDigest: async () => {},
			},
			model,
			async () =>
				JSON.stringify({
					summary: 'did a thing',
					decisions: [],
					files: [],
					errors: [],
					outcome: 'shipped',
				}),
		);
		expect(result.digested).toBe(1);
		expect(result.error).toBeUndefined();
	});
});
