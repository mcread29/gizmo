import type {
	SessionEntry,
	SessionManager,
} from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';
import { sessionTranscript } from '../../src/sessions/session-transcript';

let counter = 0;

function entry(message: unknown, id = `e${(counter += 1)}`): SessionEntry {
	return {
		type: 'message',
		id,
		parentId: null,
		timestamp: new Date().toISOString(),
		message,
	} as SessionEntry;
}

function assistantWithTool(
	toolId: string,
	options: { stopReason?: string; text?: string } = {},
) {
	return entry({
		role: 'assistant',
		content: [
			{ type: 'text', text: options.text ?? 'working on it' },
			{
				type: 'toolCall',
				id: toolId,
				name: 'edit',
				arguments: { path: 'a.cs' },
			},
		],
		timestamp: Date.now(),
		...(options.stopReason ? { stopReason: options.stopReason } : {}),
	});
}

function toolResult(toolId: string, isError = false) {
	return entry({
		role: 'toolResult',
		toolCallId: toolId,
		content: [{ type: 'text', text: isError ? 'boom' : 'done' }],
		isError,
	});
}

function managerOf(branch: SessionEntry[]): SessionManager {
	return {
		getBranch: () => branch,
		getLabel: () => undefined,
		getEntries: () => branch,
		getLeafId: () => branch[branch.length - 1]?.id ?? null,
	} as unknown as SessionManager;
}

function toolsOf(branch: SessionEntry[]) {
	return sessionTranscript(managerOf(branch)).flatMap(
		(message) => message.tools,
	);
}

describe('sessionTranscript tool settling', () => {
	it('completes a tool call that received a result', () => {
		const [tool] = toolsOf([assistantWithTool('t1'), toolResult('t1')]);

		expect(tool?.status).toBe('complete');
		expect(tool?.statusText).toBe('Completed');
	});

	it('marks a failed tool result as an error', () => {
		const [tool] = toolsOf([assistantWithTool('t1'), toolResult('t1', true)]);

		expect(tool?.status).toBe('error');
		expect(tool?.statusText).toBe('Failed');
	});

	/**
	 * The transcript is rebuilt from the session file on every load, so a call
	 * left "running" reads that way forever — surviving reloads and restarts.
	 */
	it('interrupts a tool call whose turn was aborted mid-stream', () => {
		const [tool] = toolsOf([
			assistantWithTool('t1', { stopReason: 'aborted' }),
		]);

		expect(tool?.status).toBe('error');
		expect(tool?.statusText).toBe('Interrupted');
	});

	it('interrupts a tool call whose turn ended in an error', () => {
		const [tool] = toolsOf([assistantWithTool('t1', { stopReason: 'error' })]);

		expect(tool?.statusText).toBe('Interrupted');
	});

	it('interrupts an unanswered call once the conversation moved on', () => {
		const tools = toolsOf([
			assistantWithTool('t1'),
			entry({ role: 'user', content: [{ type: 'text', text: 'never mind' }] }),
			assistantWithTool('t2'),
			toolResult('t2'),
		]);

		expect(tools[0]?.statusText).toBe('Interrupted');
		expect(tools[1]?.statusText).toBe('Completed');
	});

	/** Tools execute after their message is written, so the newest turn's may run. */
	it('leaves the newest turn running while its tool is still executing', () => {
		const [tool] = toolsOf([assistantWithTool('t1')]);

		expect(tool?.status).toBe('running');
		expect(tool?.statusText).toBe('Starting');
	});

	it('keeps sibling calls running while one of a batch has returned', () => {
		const branch = [
			entry({
				role: 'assistant',
				content: [
					{ type: 'toolCall', id: 't1', name: 'read', arguments: {} },
					{ type: 'toolCall', id: 't2', name: 'edit', arguments: {} },
				],
				timestamp: Date.now(),
			}),
			toolResult('t1'),
		];

		const tools = toolsOf(branch);

		expect(tools[0]?.status).toBe('complete');
		expect(tools[1]?.status).toBe('running');
	});
});

describe('sessionTranscript interruption', () => {
	function messagesOf(branch: SessionEntry[]) {
		return sessionTranscript(managerOf(branch));
	}

	/**
	 * A turn that died before writing anything renders as an empty block, which
	 * reads as the app having lost the response rather than the run having
	 * stopped.
	 */
	it('marks an aborted turn as interrupted', () => {
		const [message] = messagesOf([
			entry({
				role: 'assistant',
				content: [],
				timestamp: Date.now(),
				stopReason: 'aborted',
			}),
		]);

		expect(message?.interrupted).toBe(true);
	});

	it('leaves a turn that ran to completion unmarked', () => {
		const [message] = messagesOf([
			entry({
				role: 'assistant',
				content: [{ type: 'text', text: 'Done' }],
				timestamp: Date.now(),
				stopReason: 'stop',
			}),
		]);

		expect(message?.interrupted).toBeUndefined();
	});
});
