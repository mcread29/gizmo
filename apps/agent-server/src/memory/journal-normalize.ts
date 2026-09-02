import type {
	SessionEntry,
	SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';

/**
 * Byte budgets applied while normalizing a span for the journal. Successful
 * tool results are the bulk of a transcript and almost none of its durable
 * value, so they are trimmed hardest; prose written by the user or the model
 * is never trimmed, because that is where decisions actually live.
 */
export interface NormalizeLimits {
	toolResult: number;
	toolArguments: number;
	reasoning: number;
}

export const defaultNormalizeLimits: NormalizeLimits = {
	toolResult: 800,
	toolArguments: 600,
	reasoning: 1200,
};

export interface NormalizedSegment {
	body: string;
	messages: number;
}

/**
 * Renders a span of session entries as the journal's on-disk form: readable
 * markdown that keeps every user and assistant message intact while
 * collapsing tool noise. Non-message entries are skipped — compaction and
 * branch summaries are derived artifacts, and the journal only records source
 * material.
 */
export function normalizeSegment(
	entries: readonly SessionEntry[],
	limits: NormalizeLimits = defaultNormalizeLimits,
): NormalizedSegment {
	const sections: string[] = [];
	const toolNames = new Map<string, string>();
	let messages = 0;

	for (const entry of entries) {
		if (entry.type !== 'message') continue;
		const { message } = entry as SessionMessageEntry;

		if (message.role === 'user') {
			messages += 1;
			sections.push(`## user\n\n${textContent(message.content).trim()}`);
			continue;
		}

		if (message.role === 'assistant') {
			// An assistant turn can carry only a stop reason; skip the empty header.
			const section = assistantSection(message, toolNames, limits);
			if (section) {
				messages += 1;
				sections.push(section);
			}
			continue;
		}

		if (message.role === 'toolResult') {
			const name = toolNames.get(message.toolCallId) ?? 'tool';
			sections.push(toolResultSection(name, message, limits));
		}
	}

	return { body: sections.join('\n\n'), messages };
}

function assistantSection(
	message: { content: unknown },
	toolNames: Map<string, string>,
	limits: NormalizeLimits,
): string | undefined {
	const parts = ['## assistant'];
	const text = textContent(message.content).trim();
	if (text) parts.push(text);

	const reasoning = reasoningText(message.content).trim();
	if (reasoning) {
		parts.push(`### reasoning\n\n${truncate(reasoning, limits.reasoning)}`);
	}

	for (const call of toolCalls(message.content)) {
		toolNames.set(call.id, call.name);
		const args = JSON.stringify(call.arguments ?? {}, null, 2);
		parts.push(
			`### tool ${call.name}\n\n\`\`\`json\n${truncate(args, limits.toolArguments)}\n\`\`\``,
		);
	}

	return parts.length > 1 ? parts.join('\n\n') : undefined;
}

/**
 * Failures are kept whole: an error is short, and it is usually the reason a
 * later decision was made. Successful output is trimmed to head and tail.
 */
function toolResultSection(
	name: string,
	message: { content: unknown; isError?: boolean },
	limits: NormalizeLimits,
): string {
	const text = textContent(message.content).trim();
	if (message.isError) {
		return `#### ${name} → error\n\n\`\`\`\n${text}\n\`\`\``;
	}
	return `#### ${name} → ok\n\n\`\`\`\n${truncate(text, limits.toolResult)}\n\`\`\``;
}

/** Keeps both ends, which is where a result's shape and its tail both show. */
function truncate(text: string, limit: number): string {
	if (text.length <= limit) return text;
	const half = Math.floor((limit - 1) / 2);
	const dropped = text.length - half * 2;
	return `${text.slice(0, half)}\n…[truncated ${dropped} chars]…\n${text.slice(-half)}`;
}

interface ToolCallView {
	id: string;
	name: string;
	arguments: unknown;
}

function toolCalls(content: unknown): ToolCallView[] {
	if (!Array.isArray(content)) return [];
	return content
		.filter((item) => isRecord(item) && item.type === 'toolCall')
		.map((item) => {
			const record = item as Record<string, unknown>;
			return {
				id: String(record.id ?? ''),
				name: String(record.name ?? 'tool'),
				arguments: toolCallArguments(record),
			};
		});
}

// Pi has used each of these keys across transcript versions.
function toolCallArguments(record: Record<string, unknown>): unknown {
	for (const key of ['args', 'arguments', 'input', 'parameters']) {
		if (record[key] !== undefined) return record[key];
	}
}

function textContent(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter(
			(item) =>
				isRecord(item) && item.type === 'text' && typeof item.text === 'string',
		)
		.map((item) => (item as { text: string }).text)
		.join('');
}

function reasoningText(content: unknown): string {
	if (!Array.isArray(content)) return '';
	return content
		.filter((item) => isRecord(item) && item.type === 'thinking')
		.map((item) => {
			const thinking = (item as Record<string, unknown>).thinking;
			return typeof thinking === 'string' ? thinking : '';
		})
		.filter(Boolean)
		.join('\n\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object' && 'type' in value);
}
