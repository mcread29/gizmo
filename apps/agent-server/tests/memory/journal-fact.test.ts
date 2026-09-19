import { describe, expect, it } from 'vitest';
import {
	type SegmentFacts,
	currentFacts,
	factHistory,
	normalizeSubject,
	parseFacts,
} from '../../src/memory/journal-fact';

function entry(segment: string, facts: unknown[]): SegmentFacts {
	return {
		segment,
		at: '2026-01-01T00:00:00.000Z',
		model: 'test/model',
		facts: facts as SegmentFacts['facts'],
	};
}

function fact(id: string, subject: string, statement: string, supersedes: string[] = []) {
	const segment = id.split('#')[0] ?? id;
	return { id, segment, at: '', subject, statement, supersedes };
}

describe('currentFacts', () => {
	it('keeps every fact when nothing supersedes anything', () => {
		const live = currentFacts([
			entry('0001', [fact('0001#1', 'digest model', 'The digest model is minimax-m3.')]),
			entry('0002', [fact('0002#1', 'journal format', 'Segments are markdown.')]),
		]);
		expect(live.map((f) => f.id)).toEqual(['0001#1', '0002#1']);
	});

	/** The whole reason the tier exists. */
	it('drops a fact a later segment retires', () => {
		const live = currentFacts([
			entry('0001', [fact('0001#1', 'digest model', 'The digest model is minimax-m3.')]),
			entry('0009', [
				fact('0009#1', 'digest model', 'The digest model is glm-5.3.', ['0001#1']),
			]),
		]);
		expect(live.map((f) => f.statement)).toEqual(['The digest model is glm-5.3.']);
	});

	/**
	 * Supersession must be a recorded judgment, not an inference from recency,
	 * or complementary facts about one subject would silently retire each other.
	 */
	it('keeps two facts on one subject when neither retires the other', () => {
		const live = currentFacts([
			entry('0001', [fact('0001#1', 'digests', 'Digests are one file per segment.')]),
			entry('0002', [fact('0002#1', 'digests', 'Digest files are named by segment id.')]),
		]);
		expect(live).toHaveLength(2);
	});

	it('retires a fact regardless of the order segments are read in', () => {
		const segments = [
			entry('0009', [fact('0009#1', 'model', 'Now glm-5.3.', ['0001#1'])]),
			entry('0001', [fact('0001#1', 'model', 'Was minimax-m3.')]),
		];
		expect(currentFacts(segments).map((f) => f.id)).toEqual(['0009#1']);
	});

	it('lets one fact retire several at once', () => {
		const live = currentFacts([
			entry('0001', [fact('0001#1', 'a', 'One.'), fact('0001#2', 'a', 'Two.')]),
			entry('0002', [fact('0002#1', 'a', 'Neither.', ['0001#1', '0001#2'])]),
		]);
		expect(live.map((f) => f.id)).toEqual(['0002#1']);
	});

	it('survives a fact retiring one that was already retired', () => {
		const live = currentFacts([
			entry('0001', [fact('0001#1', 'a', 'First.')]),
			entry('0002', [fact('0002#1', 'a', 'Second.', ['0001#1'])]),
			entry('0003', [fact('0003#1', 'a', 'Third.', ['0001#1', '0002#1'])]),
		]);
		expect(live.map((f) => f.id)).toEqual(['0003#1']);
	});
});

describe('factHistory', () => {
	it('returns retired facts too, newest first', () => {
		const segments = [
			entry('0001', [fact('0001#1', 'digest model', 'minimax-m3.')]),
			entry('0009', [fact('0009#1', 'Digest Model', 'glm-5.3.', ['0001#1'])]),
		];
		expect(factHistory(segments, 'digest model').map((f) => f.id)).toEqual([
			'0009#1',
			'0001#1',
		]);
	});
});

describe('normalizeSubject', () => {
	it('treats model-written spellings of one subject as the same', () => {
		expect(normalizeSubject('Digest Model')).toBe(normalizeSubject('digest-model'));
		expect(normalizeSubject(' journal  index ')).toBe('journal index');
	});
});

describe('parseFacts', () => {
	const known = new Set(['0001#1']);

	it('numbers ids per segment', () => {
		const parsed = parseFacts(
			JSON.stringify({
				facts: [
					{ subject: 'a', statement: 'One.' },
					{ subject: 'b', statement: 'Two.' },
				],
			}),
			'0007',
			'test/model',
			known,
		);
		expect(parsed?.facts.map((f) => f.id)).toEqual(['0007#1', '0007#2']);
	});

	it('accepts an empty fact list as a real answer', () => {
		const parsed = parseFacts('{"facts": []}', '0007', 'test/model', known);
		expect(parsed).toBeDefined();
		expect(parsed?.facts).toEqual([]);
	});

	/**
	 * An invented id would retire nothing, but it would also conceal that the
	 * supersession the model claimed never took effect.
	 */
	it('drops superseded ids the model was never shown', () => {
		const parsed = parseFacts(
			JSON.stringify({
				facts: [{ subject: 'a', statement: 'New.', supersedes: ['0001#1', '9999#1'] }],
			}),
			'0007',
			'test/model',
			known,
		);
		expect(parsed?.facts[0]?.supersedes).toEqual(['0001#1']);
	});

	it('finds the object inside fences and prose', () => {
		const parsed = parseFacts(
			'Sure!\n```json\n{"facts":[{"subject":"a","statement":"One."}]}\n```',
			'0007',
			'test/model',
			known,
		);
		expect(parsed?.facts).toHaveLength(1);
	});

	it('accepts a bare array', () => {
		const parsed = parseFacts(
			'[{"subject":"a","statement":"One."}]',
			'0007',
			'test/model',
			known,
		);
		expect(parsed?.facts).toHaveLength(1);
	});

	it('skips entries missing a subject or a statement', () => {
		const parsed = parseFacts(
			JSON.stringify({
				facts: [{ subject: 'a' }, { statement: 'b' }, { subject: 'c', statement: 'Real.' }],
			}),
			'0007',
			'test/model',
			known,
		);
		expect(parsed?.facts.map((f) => f.statement)).toEqual(['Real.']);
	});

	it('returns undefined when the answer is not facts at all', () => {
		expect(parseFacts('I cannot help with that.', '0007', 'm', known)).toBeUndefined();
	});
});
