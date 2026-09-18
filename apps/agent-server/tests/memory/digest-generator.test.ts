import { describe, expect, it } from 'vitest';
import {
	backfillDigests,
	generateDigest,
	type BackfillStores,
	type DigestModelRef,
} from '../../src/memory/digest-generator';
import type { JournalDigest } from '../../src/memory/journal-digest';

const model: DigestModelRef = { provider: 'p', id: 'm' };

const validDigest = JSON.stringify({
	summary: 'Fixed the id collision.',
	decisions: ['Suffix ids with the first entry id.'],
	files: ['src/journal-store.ts'],
	errors: [],
	outcome: 'shipped',
});

/** An in-memory pair of stores, so the pipeline is tested without a disk. */
function stubStores(segments: Record<string, string>): BackfillStores & {
	written: Map<string, JournalDigest>;
} {
	const written = new Map<string, JournalDigest>();
	return {
		written,
		listSegments: async () => Object.keys(segments).sort(),
		readSegment: async (id) => segments[id],
		digestedSegments: async () => [...written.keys()],
		writeDigest: async (digest) => {
			written.set(digest.segment, digest);
		},
	};
}

describe('generateDigest', () => {
	it('parses a digest and stamps the model that wrote it', async () => {
		const digest = await generateDigest(
			'0001',
			'transcript',
			model,
			async () => validDigest,
		);

		expect(digest?.segment).toBe('0001');
		expect(digest?.model).toBe('p/m');
		expect(digest?.summary).toBe('Fixed the id collision.');
		expect(digest?.decisions).toEqual(['Suffix ids with the first entry id.']);
		expect(digest?.outcome).toBe('shipped');
	});

	/**
	 * A digest is derived, so every failure is a missing digest rather than a
	 * raised error — callers journal and continue instead of handling faults.
	 */
	it('returns nothing when the model fails', async () => {
		const digest = await generateDigest('0001', 'x', model, async () => {
			throw new Error('provider is down');
		});

		expect(digest).toBeUndefined();
	});

	it('returns nothing when the answer is not a digest', async () => {
		expect(
			await generateDigest('0001', 'x', model, async () => 'I cannot help.'),
		).toBeUndefined();
	});

	it('reads a digest out of the prose and fences models add', async () => {
		const digest = await generateDigest(
			'0001',
			'x',
			model,
			async () => `Sure! Here you go:\n\`\`\`json\n${validDigest}\n\`\`\``,
		);

		expect(digest?.summary).toBe('Fixed the id collision.');
	});

	/** An empty summary describes nothing, and would look generated later. */
	it('rejects a digest with no summary', async () => {
		const digest = await generateDigest('0001', 'x', model, async () =>
			JSON.stringify({ summary: '   ', outcome: 'shipped' }),
		);

		expect(digest).toBeUndefined();
	});

	it('falls back to explored for an unrecognized outcome', async () => {
		const digest = await generateDigest('0001', 'x', model, async () =>
			JSON.stringify({ summary: 'Looked around.', outcome: 'finished' }),
		);

		expect(digest?.outcome).toBe('explored');
	});
});

describe('backfillDigests', () => {
	it('digests every segment and reports progress', async () => {
		const stores = stubStores({ '0001': 'a', '0002': 'b', '0003': 'c' });
		const seen: number[] = [];

		const result = await backfillDigests(
			stores,
			model,
			async () => validDigest,
			{ onProgress: ({ done }) => seen.push(done), concurrency: 1 },
		);

		expect(result).toEqual({
			digested: 3,
			skipped: 0,
			failed: 0,
			aborted: false,
		});
		expect(seen).toEqual([1, 2, 3]);
		expect([...stores.written.keys()].sort()).toEqual(['0001', '0002', '0003']);
	});

	/** Re-running must cost nothing, so a backfill is safe to trigger twice. */
	it('skips segments that already have a digest', async () => {
		const stores = stubStores({ '0001': 'a', '0002': 'b' });
		await backfillDigests(stores, model, async () => validDigest);

		let calls = 0;
		const second = await backfillDigests(stores, model, async () => {
			calls += 1;
			return validDigest;
		});

		expect(calls).toBe(0);
		expect(second).toEqual({
			digested: 0,
			skipped: 2,
			failed: 0,
			aborted: false,
		});
	});

	it('regenerates existing digests when asked', async () => {
		const stores = stubStores({ '0001': 'a' });
		await backfillDigests(stores, model, async () => validDigest);

		const again = await backfillDigests(
			stores,
			model,
			async () => validDigest,
			{
				regenerate: true,
			},
		);

		expect(again.digested).toBe(1);
		expect(again.skipped).toBe(0);
	});

	/** One bad segment must not end the run — it is counted and passed over. */
	it('counts failures and keeps going', async () => {
		const stores = stubStores({
			'0001': 'ok-one',
			'0002': 'TRIPWIRE',
			'0003': 'ok-three',
		});

		const result = await backfillDigests(
			stores,
			model,
			async (_system, prompt) => {
				if (prompt.includes('TRIPWIRE')) throw new Error('rate limited');
				return validDigest;
			},
			{ concurrency: 1 },
		);

		expect(result.digested).toBe(2);
		expect(result.failed).toBe(1);
		expect(stores.written.has('0002')).toBe(false);
	});

	/** Work already done is kept, so the next run resumes rather than restarts. */
	it('stops when aborted and keeps what it finished', async () => {
		const stores = stubStores({ '0001': 'a', '0002': 'b', '0003': 'c' });
		const controller = new AbortController();

		const result = await backfillDigests(
			stores,
			model,
			async () => {
				controller.abort();
				return validDigest;
			},
			{ signal: controller.signal, concurrency: 1 },
		);

		expect(result.aborted).toBe(true);
		expect(result.digested).toBe(1);
		expect(stores.written.size).toBe(1);
	});

	it('runs several segments at once without dropping or repeating any', async () => {
		const segments = Object.fromEntries(
			Array.from({ length: 20 }, (_, n) => [String(n).padStart(4, '0'), 'x']),
		);
		const stores = stubStores(segments);
		let inFlight = 0;
		let peak = 0;

		const result = await backfillDigests(
			stores,
			model,
			async () => {
				inFlight += 1;
				peak = Math.max(peak, inFlight);
				await new Promise((resolve) => setTimeout(resolve, 1));
				inFlight -= 1;
				return validDigest;
			},
			{ concurrency: 4 },
		);

		expect(result.digested).toBe(20);
		expect(stores.written.size).toBe(20);
		expect(peak).toBeGreaterThan(1);
		expect(peak).toBeLessThanOrEqual(4);
	});
});
