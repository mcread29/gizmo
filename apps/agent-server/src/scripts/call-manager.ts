import { spawn, type ChildProcess } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { isPathWithin } from '../path-utils';
import type { CallRecord, SpawnCallOptions } from './call-state';

/** Raw bytes kept per stream; reports clamp to maxReportedChars. */
const maxBufferedChars = 80_000;

const runnableExtensions = new Set([
	'.ts',
	'.tsx',
	'.js',
	'.mjs',
	'.cjs',
	'.mts',
	'.cts',
]);

type Waiter = {
	resolve: (record: CallRecord) => void;
	reject: (error: Error) => void;
};

export interface CallManager {
	spawn(options: SpawnCallOptions): Promise<CallRecord>;
	get(id: string): CallRecord | undefined;
	list(): CallRecord[];
	waitFor(
		ids: string[],
		signal?: AbortSignal,
		onPending?: (pending: string[]) => void,
	): Promise<CallRecord[]>;
	cancel(ids: string[]): string[];
	disposeAll(): Promise<void>;
	onSettled?: (record: CallRecord, consumed: boolean) => void;
}

/** Detached Bun runs with no timeout and no shell (argv only, like run-script). */
export function createCallManager(): CallManager {
	const calls = new Map<string, CallRecord>();
	const procs = new Map<string, ChildProcess>();
	const waiters = new Map<string, Set<Waiter>>();
	let disposed = false;
	let onSettled: ((record: CallRecord, consumed: boolean) => void) | undefined;

	const append = (
		record: CallRecord,
		stream: 'stdout' | 'stderr',
		chunk: string,
	) => {
		const next = record[stream] + chunk;
		if (next.length > maxBufferedChars) {
			record[stream] = next.slice(-maxBufferedChars);
			record.truncated = true;
		} else record[stream] = next;
	};

	const settle = (record: CallRecord) => {
		record.finishedAt = Date.now();
		procs.delete(record.id);
		const pending = waiters.get(record.id);
		const consumed = pending !== undefined && pending.size > 0;
		if (pending) {
			waiters.delete(record.id);
			for (const waiter of pending) waiter.resolve({ ...record });
		}
		onSettled?.({ ...record }, consumed);
	};

	const manager: CallManager = {
		set onSettled(handler: CallManager['onSettled']) {
			onSettled = handler;
		},

		async spawn(options) {
			if (disposed) throw new Error('Call manager is disposed.');
			const workspacePath = resolve(options.workspacePath);
			const absolute = resolve(workspacePath, options.script);
			if (!isPathWithin(workspacePath, absolute)) {
				throw new Error(
					`Script must be inside the workspace: ${options.script}`,
				);
			}
			const extension = extname(absolute).toLowerCase();
			if (!runnableExtensions.has(extension)) {
				throw new Error(
					`Only TypeScript and JavaScript files can be run (got "${extension || options.script}"). Shell scripts are not supported.`,
				);
			}
			const info = await stat(absolute).catch(() => undefined);
			if (!info?.isFile()) throw new Error(`No such script: ${options.script}`);
			const args = [...(options.args ?? [])];
			if (args.some((argument) => typeof argument !== 'string')) {
				throw new Error('Script arguments must be strings');
			}

			const id = `call_${randomBytes(4).toString('hex')}`;
			const record: CallRecord = {
				id,
				label: (options.label ?? options.script).slice(0, 160) || id,
				script: relative(workspacePath, absolute),
				cwd: workspacePath,
				status: 'running',
				startedAt: Date.now(),
				stdout: '',
				stderr: '',
				truncated: false,
			};
			calls.set(id, record);

			let proc: ChildProcess;
			try {
				proc = spawn('bun', ['run', absolute, ...args], {
					cwd: workspacePath,
					shell: false,
					stdio: ['ignore', 'pipe', 'pipe'],
					windowsHide: true,
				});
			} catch (error) {
				record.status = 'error';
				record.error = error instanceof Error ? error.message : String(error);
				settle(record);
				return { ...record };
			}
			procs.set(id, proc);
			proc.stdout?.on('data', (chunk) =>
				append(record, 'stdout', String(chunk)),
			);
			proc.stderr?.on('data', (chunk) =>
				append(record, 'stderr', String(chunk)),
			);
			proc.on('error', (error: Error & { code?: unknown }) => {
				if (record.status !== 'running') return;
				if (error.code === 'ENOENT') {
					record.status = 'error';
					record.error =
						'Bun is required to run scripts but was not found on PATH.';
				} else {
					record.status = 'error';
					record.error = error.message;
				}
				settle(record);
			});
			proc.on('close', (code, signal) => {
				if (record.status !== 'running') return;
				if (signal) {
					record.status = 'cancelled';
					record.error = `Cancelled (${signal}).`;
				} else if (code === 0) {
					record.status = 'done';
					record.exitCode = 0;
				} else {
					record.status = 'error';
					record.exitCode = code ?? 1;
				}
				settle(record);
			});
			return { ...record };
		},

		get(id) {
			const record = calls.get(id);
			return record ? { ...record } : undefined;
		},
		list() {
			return [...calls.values()].map((record) => ({ ...record }));
		},

		waitFor(ids, signal, onPending) {
			const unique = [...new Set(ids)];
			if (unique.length === 0)
				return Promise.reject(new Error('Provide at least one call id.'));
			for (const id of unique) {
				if (!calls.has(id))
					return Promise.reject(new Error(`Unknown call id: ${id}`));
			}
			const settled = unique.filter(
				(id) => calls.get(id)?.status !== 'running',
			);
			const pending = unique.filter(
				(id) => calls.get(id)?.status === 'running',
			);
			if (pending.length === 0) {
				return Promise.resolve(unique.map((id) => ({ ...calls.get(id)! })));
			}
			onPending?.(pending);
			return new Promise<CallRecord[]>((resolve, reject) => {
				const results = new Map<string, CallRecord>();
				for (const id of settled) results.set(id, { ...calls.get(id)! });
				let done = false;
				const cleanup = () => {
					for (const id of pending) {
						const set = waiters.get(id);
						if (set) {
							set.delete(waiter);
							if (set.size === 0) waiters.delete(id);
						}
					}
					signal?.removeEventListener('abort', onAbort);
				};
				const waiter: Waiter = {
					resolve: (record) => {
						if (done) return;
						results.set(record.id, record);
						if (results.size !== unique.length) return;
						done = true;
						cleanup();
						resolve(unique.map((id) => results.get(id)!));
					},
					reject: (error) => {
						if (done) return;
						done = true;
						cleanup();
						reject(error);
					},
				};
				const onAbort = () => {
					waiter.reject(
						signal?.reason instanceof Error
							? signal.reason
							: new Error('Wait aborted. Calls keep running.'),
					);
				};
				if (signal?.aborted) {
					onAbort();
					return;
				}
				signal?.addEventListener('abort', onAbort, { once: true });
				for (const id of pending) {
					let set = waiters.get(id);
					if (!set) {
						set = new Set();
						waiters.set(id, set);
					}
					set.add(waiter);
				}
			});
		},

		cancel(ids) {
			const cancelled: string[] = [];
			for (const id of new Set(ids)) {
				const record = calls.get(id);
				if (!record || record.status !== 'running') continue;
				try {
					procs.get(id)?.kill('SIGTERM');
				} catch {
					/* Already exited; close settles. */
				}
				cancelled.push(id);
			}
			return cancelled;
		},

		async disposeAll() {
			disposed = true;
			for (const [, proc] of procs) {
				try {
					proc.kill('SIGTERM');
				} catch {
					/* Exiting processes settle on their own. */
				}
			}
			for (const [, pending] of waiters) {
				for (const waiter of pending)
					waiter.reject(new Error('Call manager is disposed.'));
			}
			waiters.clear();
		},
	};
	return manager;
}
