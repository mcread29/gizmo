import { describe, expect, it, vi } from 'vitest';
import {
	type FactBuildStores,
	buildFacts,
	generateFacts,
} from '../../src/memory/fact-generator';
import type { JournalDigest } from '../../src/memory/journal-digest';
import type { SegmentFacts } from '../../src/memory/journal-fact';

const model = { provider: 'test', id: 'model' };

function digest(segment: string, summary: string, decisions: string[] = []): JournalDigest {
	return {
		segment,
		at: '',
		model: 'test/model',
		summary,
		decisions,
		files: [],
		errors: [],
		outcome: 'shipped',
	};
}

function stores(digests: JournalDigest[]) {
	const written: SegmentFacts[] = [];
	const store: FactBuildStores = {
		listDigests: async () => digests,
		listFacts: async () => written,
		writeFacts: async (entry) => void written.push(entry),
	};
	return { store, written };
}

describe('generateFacts', () => {
	it('reports the reason when the model throws', async () => {
		const onFailure = vi.fn();
		const result = await generateFacts(
			digest('0001', 'Did a thing.'),
			[],
			model,
			async () => {
				throw new Error('rate limited');
			},
			undefined,
			onFailure,
		);
		expect(result).toBeUndefined();
		expect(onFailure).toHaveBeenCalledWith('rate limited');
	});

	it('reports the answer when it is not facts', async () => {
		const onFailure = vi.fn();
		await generateFacts(
			digest('0001', 'Did a thing.'),
			[],
			model,
			async () => 'I am unable to do that.',
			undefined,
			onFailure,
		);
		expect(onFailure).toHaveBeenCalledWith(
			expect.stringContaining('I am unable to do that.'),
		);
	});

	/**
	 * The model can only retire what it was shown, so a citation for a fact
	 * filtered out of its context must not take effect.
	 */
	it('ignores a superseded id that was never in the prompt', async () => {
		const hidden = {
			id: '0001#1',
			segment: '0001',
			at: '',
			subject: 'quantum chromodynamics',
			statement: 'Nothing to do with this digest.',
			supersedes: [],
		};
		const entry = await generateFacts(
			digest('0002', 'Changed the digest model.'),
			[hidden],
			model,
			async () =>
				JSON.stringify({
					facts: [{ subject: 'digest model', statement: 'Now glm-5.3.', supersedes: ['0001#1'] }],
				}),
		);
		expect(entry?.facts[0]?.supersedes).toEqual([]);
	});
});

describe('buildFacts', () => {
	it('processes digests oldest first', async () => {
		const seen: string[] = [];
		const { store } = stores([digest('0003', 'c'), digest('0001', 'a'), digest('0002', 'b')]);
		await buildFacts(store, model, async (_system, prompt) => {
			seen.push(prompt.match(/Summary: (\w)/)?.[1] ?? '?');
			return '{"facts":[]}';
		});
		expect(seen).toEqual(['a', 'b', 'c']);
	});

	/**
	 * The sequential constraint made visible: a segment must be able to retire
	 * what the segment before it asserted, which is only possible if the
	 * earlier result is already in the record when the later one is derived.
	 */
	it('shows each segment the facts the previous one asserted', async () => {
		const { store, written } = stores([
			digest('0001', 'Set the digest model to minimax-m3.'),
			digest('0002', 'Switched the digest model to glm-5.3.'),
		]);
		await buildFacts(store, model, async (_system, prompt) => {
			if (prompt.includes('Summary: Set')) {
				expect(prompt).toContain('nothing on record yet');
				return JSON.stringify({
					facts: [{ subject: 'digest model', statement: 'The digest model is minimax-m3.' }],
				});
			}
			expect(prompt).toContain('0001#1');
			return JSON.stringify({
				facts: [
					{ subject: 'digest model', statement: 'The digest model is glm-5.3.', supersedes: ['0001#1'] },
				],
			});
		});
		expect(written[1]?.facts[0]?.supersedes).toEqual(['0001#1']);
	});

	it('counts the facts still standing, not the facts written', async () => {
		const { store } = stores([
			digest('0001', 'Set the digest model.'),
			digest('0002', 'Changed the digest model.'),
		]);
		const result = await buildFacts(store, model, async (_system, prompt) =>
			prompt.includes('nothing on record yet')
				? JSON.stringify({ facts: [{ subject: 'digest model', statement: 'Old.' }] })
				: JSON.stringify({
						facts: [
							{ subject: 'digest model', statement: 'New.', supersedes: ['0001#1'] },
						],
					}),
		);
		expect(result.processed).toBe(2);
		expect(result.facts).toBe(1);
	});

	/**
	 * The cost of preselecting context lexically. A fact the filter does not
	 * surface cannot be retired, so the tier keeps a stale entry rather than
	 * dropping a live one — the safe direction, but not a free one, and the
	 * reason relevantFacts weights the subject line heavily.
	 */
	it('leaves a fact standing when the digest shares no wording with it', async () => {
		const { store } = stores([
			digest('0001', 'Set the digest model to minimax-m3.'),
			digest('0002', 'Rewrote the shader compiler.'),
		]);
		const result = await buildFacts(store, model, async (_system, prompt) =>
			prompt.includes('nothing on record yet')
				? JSON.stringify({
						facts: [{ subject: 'digest model', statement: 'It is minimax-m3.' }],
					})
				: JSON.stringify({
						facts: [
							{ subject: 'digest model', statement: 'Gone.', supersedes: ['0001#1'] },
						],
					}),
		);
		expect(result.facts).toBe(2);
	});

	it('resumes rather than restarting', async () => {
		const { store, written } = stores([digest('0001', 'a'), digest('0002', 'b')]);
		written.push({ segment: '0001', at: '', model: 'test/model', facts: [] });
		const complete = vi.fn(async () => '{"facts":[]}');
		const result = await buildFacts(store, model, complete);
		expect(complete).toHaveBeenCalledTimes(1);
		expect(result.skipped).toBe(1);
	});

	it('regenerates the whole tier when asked', async () => {
		const { store, written } = stores([digest('0001', 'a')]);
		written.push({ segment: '0001', at: '', model: 'test/model', facts: [] });
		const complete = vi.fn(async () => '{"facts":[]}');
		await buildFacts(store, model, complete, { regenerate: true });
		expect(complete).toHaveBeenCalledTimes(1);
	});

	it('keeps what it finished when aborted', async () => {
		const controller = new AbortController();
		const { store, written } = stores([digest('0001', 'a'), digest('0002', 'b')]);
		const result = await buildFacts(store, model, async () => {
			controller.abort();
			return '{"facts":[]}';
		}, { signal: controller.signal });
		expect(result.aborted).toBe(true);
		expect(result.processed).toBe(1);
		expect(written).toHaveLength(1);
	});

	it('counts a failed segment and carries on', async () => {
		const onFailure = vi.fn();
		const { store } = stores([digest('0001', 'a'), digest('0002', 'b')]);
		const result = await buildFacts(store, model, async (_s, prompt) =>
			prompt.includes('Summary: a') ? 'not json' : '{"facts":[]}',
			{ onFailure },
		);
		expect(result.failed).toBe(1);
		expect(result.processed).toBe(1);
		expect(onFailure).toHaveBeenCalledWith('0001', expect.stringContaining('not json'));
	});
});
