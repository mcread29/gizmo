import { describe, expect, it } from 'vitest';
import { formatFactHit, searchFacts } from '../../src/memory/fact-search';
import type { JournalFact } from '../../src/memory/journal-fact';

function fact(id: string, subject: string, statement: string): JournalFact {
	return {
		id,
		segment: id.split('#')[0] ?? id,
		at: '',
		subject,
		statement,
		supersedes: [],
	};
}

const facts = [
	fact('0001#1', 'digest model', 'The digest model is minimax-m3.'),
	fact('0002#1', 'journal format', 'Segments are markdown with frontmatter.'),
	fact('0003#1', 'deployment', 'The web server is restarted through the supervisor.'),
];

describe('searchFacts', () => {
	it('finds a fact by its subject', () => {
		const hits = searchFacts(facts, ['digest']);
		expect(hits.map((hit) => hit.fact.id)).toEqual(['0001#1']);
	});

	it('returns nothing without terms', () => {
		expect(searchFacts(facts, [])).toEqual([]);
	});

	it('ranks a subject match above a statement-only match', () => {
		const ranked = searchFacts(
			[
				fact('0001#1', 'unrelated', 'Mentions the supervisor in passing.'),
				fact('0002#1', 'supervisor', 'It owns the server process tree.'),
			],
			['supervisor'],
		);
		expect(ranked[0]?.fact.id).toBe('0002#1');
	});

	/** Covering the whole query beats repeating one word of it. */
	it('prefers the fact that covers more distinct terms', () => {
		const ranked = searchFacts(
			[
				fact('0001#1', 'model', 'model model model model.'),
				fact('0002#1', 'digest model', 'The digest model is glm-5.3.'),
			],
			['digest', 'model'],
		);
		expect(ranked[0]?.fact.id).toBe('0002#1');
	});

	it('breaks ties toward the later segment', () => {
		const ranked = searchFacts(
			[fact('0001#1', 'model', 'Same.'), fact('0009#1', 'model', 'Same.')],
			['model'],
		);
		expect(ranked[0]?.fact.id).toBe('0009#1');
	});
});

describe('formatFactHit', () => {
	it('carries the segment so the claim can be traced back', () => {
		const [hit] = searchFacts(facts, ['digest']);
		expect(hit && formatFactHit(hit)).toBe(
			'- digest model: The digest model is minimax-m3. [0001]',
		);
	});
});
