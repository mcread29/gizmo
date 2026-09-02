import type { SessionEntry } from '@earendil-works/pi-coding-agent';

/**
 * Translates a Claude Code transcript into the entry shape the journal
 * normalizer already understands.
 *
 * The formats line up closely — tool calls carry `input`, thinking blocks
 * carry `thinking` — with one trap: Claude Code delivers tool results inside
 * `user` messages. Imported naively they would be journaled as things the user
 * said, burying real prose under thousands of tool payloads.
 */
interface ClaudeRecord {
	type?: unknown;
	uuid?: unknown;
	parentUuid?: unknown;
	timestamp?: unknown;
	cwd?: unknown;
	sessionId?: unknown;
	isSidechain?: unknown;
	message?: { role?: unknown; content?: unknown };
}

export interface ClaudeTranscript {
	sessionId: string;
	cwd: string;
	entries: SessionEntry[];
	startedAt: number;
}

/**
 * Parses one Claude Code JSONL file. Returns undefined when it holds no
 * usable conversation — most files carry only session metadata records.
 */
export function parseClaudeTranscript(
	raw: string,
	fallbackSessionId: string,
): ClaudeTranscript | undefined {
	const entries: SessionEntry[] = [];
	let sessionId: string | undefined;
	let cwd = '';
	let startedAt = 0;

	for (const line of raw.split('\n')) {
		if (!line.trim()) continue;
		let record: ClaudeRecord;
		try {
			record = JSON.parse(line) as ClaudeRecord;
		} catch {
			continue; // A torn line loses one message, not the transcript.
		}
		if (record.type !== 'user' && record.type !== 'assistant') continue;
		// Sidechains are subagent transcripts; they interleave incoherently.
		if (record.isSidechain === true) continue;

		if (typeof record.sessionId === 'string') sessionId ??= record.sessionId;
		if (typeof record.cwd === 'string' && !cwd) cwd = record.cwd;
		const at = Date.parse(String(record.timestamp ?? ''));
		if (Number.isFinite(at) && (!startedAt || at < startedAt)) startedAt = at;

		entries.push(...translate(record));
	}

	if (entries.length === 0) return;
	return {
		sessionId: sessionId ?? fallbackSessionId,
		cwd,
		entries,
		startedAt,
	};
}

function translate(record: ClaudeRecord): SessionEntry[] {
	const id = String(record.uuid ?? '');
	const parentId =
		typeof record.parentUuid === 'string' ? record.parentUuid : null;
	const timestamp = String(record.timestamp ?? new Date().toISOString());
	const content = record.message?.content;

	const wrap = (message: unknown, suffix = ''): SessionEntry =>
		({
			type: 'message',
			id: suffix ? `${id}${suffix}` : id,
			parentId,
			timestamp,
			message,
		}) as SessionEntry;

	if (record.type === 'assistant') {
		const blocks = Array.isArray(content) ? content.map(assistantBlock) : [];
		const kept = blocks.filter(Boolean);
		if (kept.length === 0) return [];
		return [wrap({ role: 'assistant', content: kept, timestamp })];
	}

	if (typeof content === 'string') {
		const text = cleanUserText(content);
		return text
			? [wrap({ role: 'user', content: [{ type: 'text', text }] })]
			: [];
	}
	if (!Array.isArray(content)) return [];

	// A user record is either prose or a batch of tool results, never both.
	const results: SessionEntry[] = [];
	const prose: unknown[] = [];
	let resultIndex = 0;
	for (const block of content) {
		if (!isRecord(block)) continue;
		if (block.type === 'tool_result') {
			results.push(
				wrap(
					{
						role: 'toolResult',
						toolCallId: String(block.tool_use_id ?? ''),
						content: [{ type: 'text', text: resultText(block.content) }],
						isError: block.is_error === true,
					},
					`:r${resultIndex}`,
				),
			);
			resultIndex += 1;
			continue;
		}
		if (block.type === 'text' && typeof block.text === 'string') {
			const text = cleanUserText(block.text);
			if (text) prose.push({ type: 'text', text });
		}
	}
	if (prose.length > 0) results.unshift(wrap({ role: 'user', content: prose }));
	return results;
}

function assistantBlock(block: unknown): unknown {
	if (!isRecord(block)) return;
	if (block.type === 'text' && typeof block.text === 'string') {
		return { type: 'text', text: block.text };
	}
	if (block.type === 'thinking' && typeof block.thinking === 'string') {
		return { type: 'thinking', thinking: block.thinking };
	}
	if (block.type === 'tool_use') {
		return {
			type: 'toolCall',
			id: String(block.id ?? ''),
			name: String(block.name ?? 'tool'),
			input: block.input ?? {},
		};
	}
}

/**
 * Claude Code records slash-command plumbing as user messages — the caveat
 * banner, the `<command-name>` envelope, the command's own stdout. None of it
 * is something the user said, and left in it would be the loudest repeated
 * text in the journal. System reminders are injected context, not speech, so
 * they are stripped from otherwise real messages.
 */
function cleanUserText(text: string): string {
	if (
		/<(?:local-command-|command-name>|command-message>|command-args>)/.test(
			text,
		)
	) {
		return '';
	}
	return text
		.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
		.trim();
}

/** Tool result content is a string on some records and blocks on others. */
function resultText(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter(
			(block) =>
				isRecord(block) &&
				block.type === 'text' &&
				typeof block.text === 'string',
		)
		.map((block) => (block as { text: string }).text)
		.join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object');
}
