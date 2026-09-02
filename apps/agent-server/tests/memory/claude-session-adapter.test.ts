import { describe, expect, it } from 'vitest';
import { parseClaudeTranscript } from '../../src/memory/claude-session-adapter';
import { normalizeSegment } from '../../src/memory/journal-normalize';

function jsonl(...records: unknown[]): string {
	return records.map((record) => JSON.stringify(record)).join('\n');
}

const userRecord = {
	type: 'user',
	uuid: 'u1',
	parentUuid: null,
	sessionId: 's1',
	cwd: 'C:\\work',
	timestamp: '2026-01-01T00:00:00.000Z',
	message: { role: 'user', content: 'do the thing' },
};

describe('parseClaudeTranscript', () => {
	it('ignores files that hold only session metadata', () => {
		const raw = jsonl(
			{ type: 'mode', sessionId: 's1' },
			{ type: 'attachment', sessionId: 's1' },
		);

		expect(parseClaudeTranscript(raw, 'fallback')).toBeUndefined();
	});

	it('reads session id, cwd and start time from the records', () => {
		const transcript = parseClaudeTranscript(jsonl(userRecord), 'fallback');

		expect(transcript?.sessionId).toBe('s1');
		expect(transcript?.cwd).toBe('C:\\work');
		expect(transcript?.startedAt).toBe(Date.parse(userRecord.timestamp));
	});

	/**
	 * The trap this adapter exists for: Claude Code delivers tool results in
	 * user messages, so a naive import files thousands of tool payloads as
	 * things the user said.
	 */
	it('turns tool results carried on user records into tool results', () => {
		const raw = jsonl(
			{
				type: 'assistant',
				uuid: 'a1',
				sessionId: 's1',
				cwd: 'C:\\work',
				timestamp: '2026-01-01T00:00:01.000Z',
				message: {
					role: 'assistant',
					content: [
						{
							type: 'tool_use',
							id: 't1',
							name: 'Read',
							input: { file: 'a.ts' },
						},
					],
				},
			},
			{
				type: 'user',
				uuid: 'u2',
				sessionId: 's1',
				cwd: 'C:\\work',
				timestamp: '2026-01-01T00:00:02.000Z',
				message: {
					role: 'user',
					content: [
						{ type: 'tool_result', tool_use_id: 't1', content: 'file body' },
					],
				},
			},
		);

		const transcript = parseClaudeTranscript(raw, 'fallback');
		const body = normalizeSegment(transcript?.entries ?? []).body;

		expect(body).toContain('### tool Read');
		expect(body).toContain('#### Read → ok');
		expect(body).toContain('file body');
		expect(body).not.toContain('## user');
	});

	it('maps thinking and text blocks the normalizer already understands', () => {
		const raw = jsonl({
			type: 'assistant',
			uuid: 'a1',
			sessionId: 's1',
			cwd: 'C:\\work',
			timestamp: '2026-01-01T00:00:01.000Z',
			message: {
				role: 'assistant',
				content: [
					{ type: 'thinking', thinking: 'weighing options', signature: 'x' },
					{ type: 'text', text: 'here is the answer' },
				],
			},
		});

		const body = normalizeSegment(
			parseClaudeTranscript(raw, 'f')?.entries ?? [],
		).body;

		expect(body).toContain('### reasoning');
		expect(body).toContain('weighing options');
		expect(body).toContain('here is the answer');
	});

	it('keeps an errored tool result flagged as an error', () => {
		const raw = jsonl(
			{
				type: 'assistant',
				uuid: 'a1',
				sessionId: 's1',
				cwd: 'C:\\w',
				timestamp: '2026-01-01T00:00:01.000Z',
				message: {
					role: 'assistant',
					content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }],
				},
			},
			{
				type: 'user',
				uuid: 'u2',
				sessionId: 's1',
				cwd: 'C:\\w',
				timestamp: '2026-01-01T00:00:02.000Z',
				message: {
					role: 'user',
					content: [
						{
							type: 'tool_result',
							tool_use_id: 't1',
							is_error: true,
							content: [{ type: 'text', text: 'command not found' }],
						},
					],
				},
			},
		);

		const body = normalizeSegment(
			parseClaudeTranscript(raw, 'f')?.entries ?? [],
		).body;

		expect(body).toContain('#### Bash → error');
		expect(body).toContain('command not found');
	});

	it('skips subagent sidechains', () => {
		const raw = jsonl(userRecord, {
			...userRecord,
			uuid: 'u9',
			isSidechain: true,
			message: { role: 'user', content: 'subagent chatter' },
		});

		const body = normalizeSegment(
			parseClaudeTranscript(raw, 'f')?.entries ?? [],
		).body;

		expect(body).toContain('do the thing');
		expect(body).not.toContain('subagent chatter');
	});

	it('gives each tool result on one record a distinct entry id', () => {
		const raw = jsonl({
			type: 'user',
			uuid: 'u1',
			sessionId: 's1',
			cwd: 'C:\\w',
			timestamp: '2026-01-01T00:00:00.000Z',
			message: {
				role: 'user',
				content: [
					{ type: 'tool_result', tool_use_id: 't1', content: 'one' },
					{ type: 'tool_result', tool_use_id: 't2', content: 'two' },
				],
			},
		});

		const ids = (parseClaudeTranscript(raw, 'f')?.entries ?? []).map(
			({ id }) => id,
		);

		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('noise filtering', () => {
	it('drops slash-command plumbing recorded as user messages', () => {
		const raw = [
			JSON.stringify({
				type: 'user',
				uuid: 'u1',
				sessionId: 's1',
				cwd: 'C:\w',
				timestamp: '2026-01-01T00:00:00.000Z',
				message: {
					role: 'user',
					content:
						'<command-name>/model</command-name>\n<command-args></command-args>',
				},
			}),
			JSON.stringify({
				type: 'user',
				uuid: 'u2',
				sessionId: 's1',
				cwd: 'C:\w',
				timestamp: '2026-01-01T00:00:01.000Z',
				message: {
					role: 'user',
					content:
						'<local-command-stdout>Set model to Opus</local-command-stdout>',
				},
			}),
			JSON.stringify({
				type: 'user',
				uuid: 'u3',
				sessionId: 's1',
				cwd: 'C:\w',
				timestamp: '2026-01-01T00:00:02.000Z',
				message: { role: 'user', content: 'actually build the thing' },
			}),
		].join('\n');

		const entries = parseClaudeTranscript(raw, 'f')?.entries ?? [];

		expect(entries).toHaveLength(1);
		expect(normalizeSegment(entries).body).toContain(
			'actually build the thing',
		);
	});

	it('strips injected system reminders but keeps the message', () => {
		const raw = JSON.stringify({
			type: 'user',
			uuid: 'u1',
			sessionId: 's1',
			cwd: 'C:\w',
			timestamp: '2026-01-01T00:00:00.000Z',
			message: {
				role: 'user',
				content:
					'fix the parser\n<system-reminder>Today is 2026-01-01</system-reminder>',
			},
		});

		const body = normalizeSegment(
			parseClaudeTranscript(raw, 'f')?.entries ?? [],
		).body;

		expect(body).toContain('fix the parser');
		expect(body).not.toContain('system-reminder');
	});
});
