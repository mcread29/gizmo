import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { clampOutput, type CallRecord } from './call-state';
import type { CallManager } from './call-manager';

export interface CallToolsOptions {
	manager: CallManager;
	/** Called with settled ids the waiter already consumed. */
	consume: (ids: string[]) => void;
}

function elapsed(record: CallRecord): string {
	const end = record.finishedAt ?? Date.now();
	return `${((end - record.startedAt) / 1000).toFixed(1)}s`;
}

function summarize(record: CallRecord): string {
	const head =
		record.status === 'running'
			? `${record.id} "${record.label}" still running (${elapsed(record)})`
			: record.status === 'done'
				? `${record.id} "${record.label}" finished in ${elapsed(record)} (exit 0)`
				: record.status === 'cancelled'
					? `${record.id} "${record.label}" cancelled after ${elapsed(record)}`
					: `${record.id} "${record.label}" failed after ${elapsed(record)} (exit ${record.exitCode ?? 1})`;
	const out = clampOutput(record.stdout.trim());
	const err = clampOutput(record.stderr.trim());
	const sections = [
		record.error?.trim() && `error: ${record.error.trim()}`,
		out.text && `stdout:\n${out.text}`,
		err.text && `stderr:\n${err.text}`,
		(record.truncated || out.truncated || err.truncated) &&
			'(output truncated)',
	].filter(Boolean);
	return [head, ...sections].join('\n\n');
}

/**
 * Timeout-free execution tools. `call` returns a call id now; the run keeps
 * going with no timeout and its result arrives as a follow-up message, or
 * the agent blocks for it with `wait`. Same Bun-only sandbox as run_script.
 */
export function createCallTools(options: CallToolsOptions) {
	const { manager } = options;

	const call = defineTool({
		name: 'call',
		label: 'Call script',
		description:
			'Run one TypeScript or JavaScript file from the current workspace with Bun, without a timeout. Returns a call id immediately; the result arrives as a follow-up message when it settles, or collect it with wait. Same sandbox as run_script: no shell, no pipes, no stdin, script must stay inside the workspace.',
		promptSnippet: 'Run a workspace script in the background with no timeout',
		promptGuidelines: [
			'After call, keep working; the result arrives automatically. Only call wait when you cannot proceed without it.',
			'Pass the script path relative to the workspace root; it must stay inside the workspace.',
		],
		parameters: Type.Object(
			{
				script: Type.String({ minLength: 1, maxLength: 4096 }),
				args: Type.Optional(
					Type.Array(Type.String({ maxLength: 4096 }), { maxItems: 64 }),
				),
				label: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
			},
			{ additionalProperties: false },
		),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const record = await manager.spawn({
				workspacePath: ctx.cwd,
				script: params.script,
				...(params.args ? { args: params.args } : {}),
				...(params.label ? { label: params.label } : {}),
			});
			const text = [
				`Started ${record.id} "${record.label}" (${record.script}). No timeout; it keeps running while you work.`,
				`You'll get a follow-up message when it finishes; wait(ids: ["${record.id}"]) blocks, check shows progress, cancel stops it.`,
			].join('\n');
			return {
				content: [{ type: 'text' as const, text }],
				details: { id: record.id },
			};
		},
	});

	const wait = defineTool({
		name: 'wait',
		label: 'Wait for calls',
		description:
			'Block until the listed background calls settle, then return their outputs. Prefer letting results arrive automatically; use this only when you cannot proceed without them. Aborting the wait leaves the calls running.',
		promptSnippet: 'Block for background call results',
		parameters: Type.Object(
			{
				ids: Type.Array(Type.String({ minLength: 1, maxLength: 128 }), {
					minItems: 1,
					maxItems: 16,
				}),
				timeoutSeconds: Type.Optional(
					Type.Integer({ minimum: 1, maximum: 3600 }),
				),
			},
			{ additionalProperties: false },
		),
		async execute(_toolCallId, params, signal, onUpdate) {
			const ids = [...new Set(params.ids)];
			let timeout: ReturnType<typeof setTimeout> | undefined;
			let abort: AbortController | undefined;
			let waitSignal = signal;
			if (params.timeoutSeconds !== undefined) {
				abort = new AbortController();
				waitSignal = signal
					? AbortSignal.any([signal, abort.signal])
					: abort.signal;
				timeout = setTimeout(
					() =>
						abort?.abort(
							new Error(
								`Timed out waiting for ${ids.join(', ')}. Calls keep running.`,
							),
						),
					params.timeoutSeconds * 1000,
				);
				if (timeout.unref) timeout.unref();
			}
			try {
				const records = await manager.waitFor(
					ids,
					waitSignal ?? undefined,
					(pending) => {
						onUpdate?.({
							content: [
								{
									type: 'text' as const,
									text: `Waiting for ${pending.join(', ')}...`,
								},
							],
							details: { pending },
						});
					},
				);
				if (signal?.aborted)
					throw new Error('Wait aborted. Calls keep running.');
				options.consume(ids);
				return {
					content: [
						{
							type: 'text' as const,
							text: records.map(summarize).join('\n\n---\n\n'),
						},
					],
					details: { calls: records },
				};
			} finally {
				if (timeout) clearTimeout(timeout);
			}
		},
	});

	const check = defineTool({
		name: 'call_check',
		label: 'Check call',
		description:
			'Peek at one background call without blocking: status plus the latest output tail.',
		promptSnippet: 'Peek at a background call',
		parameters: Type.Object(
			{ id: Type.String({ minLength: 1, maxLength: 128 }) },
			{ additionalProperties: false },
		),
		async execute(_toolCallId, params) {
			const record = manager.get(params.id);
			if (!record) throw new Error(`Unknown call id: ${params.id}`);
			return {
				content: [{ type: 'text' as const, text: summarize(record) }],
				details: { call: record },
			};
		},
	});

	const list = defineTool({
		name: 'call_list',
		label: 'List calls',
		description: 'List background calls in this session with their status.',
		promptSnippet: 'List background calls',
		parameters: Type.Object({}, { additionalProperties: false }),
		async execute() {
			const calls = manager.list();
			const text =
				calls.length === 0
					? 'No background calls in this session.'
					: calls
							.map(
								(record) =>
									`- ${record.id} "${record.label}" [${record.status}] ${elapsed(record)}`,
							)
							.join('\n');
			return { content: [{ type: 'text' as const, text }], details: { calls } };
		},
	});

	const cancel = defineTool({
		name: 'call_cancel',
		label: 'Cancel calls',
		description: 'Stop running background calls. Settled calls are unaffected.',
		promptSnippet: 'Stop running background calls',
		parameters: Type.Object(
			{
				ids: Type.Array(Type.String({ minLength: 1, maxLength: 128 }), {
					minItems: 1,
					maxItems: 16,
				}),
			},
			{ additionalProperties: false },
		),
		async execute(_toolCallId, params) {
			const cancelled = manager.cancel(params.ids);
			options.consume(cancelled);
			const text =
				cancelled.length === 0
					? 'Nothing to cancel: those calls already settled.'
					: `Cancelled ${cancelled.join(', ')}. Their final state still arrives as a follow-up.`;
			return {
				content: [{ type: 'text' as const, text }],
				details: { cancelled },
			};
		},
	});

	return [call, wait, check, list, cancel];
}
