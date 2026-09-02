import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { formatSearchResult, searchJournal } from './journal-search';
import type { JournalStore } from './journal-store';

/** Reads past this are almost always a mistake: search first, then read one segment. */
const maxReadBytes = 48_000;

export const journalToolNames = ['journal_search', 'journal_read'] as const;

/**
 * One line the extension can append to a system prompt that was replaced
 * wholesale, where Pi's own "Available tools" section — and with it every
 * `promptSnippet` — has been discarded.
 */
export const journalAvailabilityLine =
	'Tools journal_search and journal_read are available: journal_search finds ranked excerpts from this project’s conversation history (earlier sessions, decisions, errors, what was tried), and journal_read returns one full segment by the id a search hit names. Use journal_search before assuming past work is unknown.';

/**
 * The journal's read path. The store is resolved per call rather than bound
 * up front because the extension keys journals by workspace and a tool call
 * carries its own cwd.
 */
export function createJournalTools(storeFor: (cwd: string) => JournalStore) {
	const search = defineTool({
		name: 'journal_search',
		label: 'Search journal',
		description:
			'Lexical search across this project’s conversation history (the memory journal). Returns ranked excerpts, each labelled with the segment id and line it came from, with a few lines of surrounding context. Results are capped, so prefer specific terms over broad ones.',
		promptSnippet:
			'Search earlier sessions of this project for decisions, errors, and prior attempts',
		promptGuidelines: [
			'Use journal_search when the user refers to earlier work, a past decision, or something "we did before", and when you are about to repeat an investigation the project may already have done.',
			'After a journal_search hit, use journal_read with the segment id to see the full context before relying on it.',
		],
		parameters: Type.Object(
			{
				query: Type.String({ minLength: 1, maxLength: 500 }),
				maxResults: Type.Optional(Type.Integer({ minimum: 1, maximum: 30 })),
			},
			{ additionalProperties: false },
		),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const result = await searchJournal(storeFor(ctx.cwd), params.query, {
				...(params.maxResults ? { maxHits: params.maxResults } : {}),
			});
			return {
				content: [{ type: 'text' as const, text: formatSearchResult(result) }],
				details: result,
			};
		},
	});

	const read = defineTool({
		name: 'journal_read',
		label: 'Read journal segment',
		description:
			'Read one memory journal segment in full by id (for example "0042", as labelled in journal_search results). Optionally start from a line number to page through an unusually long segment.',
		promptSnippet:
			'Read one full segment of this project’s conversation history by id',
		parameters: Type.Object(
			{
				id: Type.String({ minLength: 1, maxLength: 16 }),
				fromLine: Type.Optional(Type.Integer({ minimum: 1 })),
			},
			{ additionalProperties: false },
		),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const text = await storeFor(ctx.cwd).read(params.id);
			if (text === undefined) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `No journal segment with id ${params.id}. Ids come from journal_search results.`,
						},
					],
					details: { id: params.id, found: false },
				};
			}
			const page = pageOf(text, params.fromLine ?? 1);
			return {
				content: [{ type: 'text' as const, text: page.text }],
				details: { id: params.id, found: true, truncated: page.truncated },
			};
		},
	});

	return [search, read];
}

function pageOf(
	text: string,
	fromLine: number,
): { text: string; truncated: boolean } {
	const lines = text.split('\n').slice(fromLine - 1);
	const kept: string[] = [];
	let bytes = 0;
	for (const line of lines) {
		bytes += Buffer.byteLength(line, 'utf8') + 1;
		if (bytes > maxReadBytes) break;
		kept.push(line);
	}
	const truncated = kept.length < lines.length;
	const next = fromLine + kept.length;
	const note = truncated
		? `\n\n…[segment continues; call journal_read again with fromLine ${next}]`
		: '';
	return { text: `${kept.join('\n')}${note}`, truncated };
}
