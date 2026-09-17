/** Pure readers over Pi's event payloads, shared by the translator. */

export interface TranslatedUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	contextUsed: number;
	cost: number;
	/** Filled in by the service, which knows the model. */
	contextWindow?: number;
}

/**
 * Context is what the next request has to carry: input, output, and cached
 * tokens. Pi's own compaction check reads the same figure (`totalTokens` when
 * the provider reports it), so the meter and the trigger agree.
 */
export function readUsage(value: unknown): TranslatedUsage | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const usage = value as Record<string, unknown>;
	const input = count(usage.input);
	const output = count(usage.output);
	const cacheRead = count(usage.cacheRead);
	const cacheWrite = count(usage.cacheWrite);
	const cost = usage.cost as { total?: unknown } | undefined;
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		contextUsed:
			count(usage.totalTokens) || input + cacheRead + cacheWrite + output,
		cost: count(cost?.total),
	};
}

function count(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
		? Math.round(value)
		: 0;
}

export function isRedactedThinking(partial: unknown, index: number): boolean {
	if (!partial || typeof partial !== 'object' || !('content' in partial))
		return false;
	const content = (partial as { content: unknown }).content;
	if (!Array.isArray(content)) return false;
	const block = content[index] as
		{ type?: string; redacted?: boolean } | undefined;
	return block?.type === 'thinking' && block.redacted === true;
}

export function getMessageText(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter(
			(item): item is { type: 'text'; text: string } => item?.type === 'text',
		)
		.map((item) => item.text)
		.join('');
}

export function getToolResultText(result: unknown): string {
	if (!result || typeof result !== 'object' || !('content' in result))
		return '';
	return getMessageText(result.content);
}

/** The part of a finished compaction worth showing in the thread. */
export function readCompactionResult(
	value: unknown,
): { tokensBefore: number; summary: string } | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const result = value as { tokensBefore?: unknown; summary?: unknown };
	if (typeof result.summary !== 'string') return undefined;
	return { tokensBefore: count(result.tokensBefore), summary: result.summary };
}
