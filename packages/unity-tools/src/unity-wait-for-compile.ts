import { executeUnityCommand, type UnityCommandDetails } from './unity-command';
import { readUnityConsole, type UnityConsoleEntry } from './unity-console';
import { unityDiagnostic } from './unity-diagnostics';
import type { UnityCliMessage, UnityJsonDetails } from './unity-json';
import type { UnityCommandRunner } from './unity-runner';

export interface WaitForUnityCompileOptions {
	projectPath: string;
	timeoutMs?: number;
	pollIntervalMs?: number;
	signal?: AbortSignal;
	onProgress?: (message: string) => void;
}

export interface UnityCompileDetails extends UnityJsonDetails {
	state:
		| 'ready'
		| 'compile_failed'
		| 'disconnected'
		| 'unavailable'
		| 'timeout'
		| 'error';
	attempts: number;
	compileStatus?: string;
	consoleEntries: UnityConsoleEntry[];
	consoleCursor?: number;
	compilationPending: false;
}

export async function waitForUnityCompile(
	runner: UnityCommandRunner,
	options: WaitForUnityCompileOptions,
): Promise<UnityCompileDetails> {
	const startedAt = performance.now();
	const timeoutMs = options.timeoutMs ?? 120_000;
	const pollIntervalMs = options.pollIntervalMs ?? 750;
	const baseline = await readUnityConsole(runner, {
		projectPath: options.projectPath,
		tail: 1,
		level: 'warn',
		signal: options.signal,
	});
	let attempts = 0;
	options.onProgress?.('Requesting Unity script recompile');
	let last: UnityCommandDetails = await executeUnityCommand(runner, {
		projectPath: options.projectPath,
		command: 'recompile',
		signal: options.signal,
	});
	if (!last.ok) {
		return finish(
			runner,
			last,
			failureState(last),
			options,
			attempts,
			baseline.cursor,
		);
	}
	options.onProgress?.('Waiting for Unity compilation and domain reload');

	while (performance.now() - startedAt < timeoutMs) {
		if (options.signal?.aborted) {
			return finish(runner, last, 'error', options, attempts, baseline.cursor, [
				{
					code: 'UNITY_CLI_ABORTED',
					message: 'Unity compilation was cancelled.',
				},
			]);
		}

		last = await executeUnityCommand(runner, {
			projectPath: options.projectPath,
			command: 'recompile_status',
			signal: options.signal,
		});
		attempts++;
		if (last.ok) {
			const compile = compileResult(last.data);
			options.onProgress?.(
				compile.status
					? `Unity compilation: ${compile.status}`
					: 'Waiting for Unity compilation status',
			);
			if (compile.failed) {
				return finish(
					runner,
					last,
					'compile_failed',
					options,
					attempts,
					baseline.cursor,
					compile.errors.length
						? compile.errors
						: [
								{
									code: 'UNITY_COMPILE_FAILED',
									message: 'Unity reported that script compilation failed.',
								},
							],
					compile.status,
				);
			}
			if (compileComplete(compile.status)) {
				return finish(
					runner,
					last,
					'ready',
					options,
					attempts,
					baseline.cursor,
					last.errors,
					compile.status,
				);
			}
		}

		await wait(pollIntervalMs, options.signal);
	}

	return finish(runner, last, 'timeout', options, attempts, baseline.cursor, [
		...last.errors,
		{
			code: 'UNITY_COMPILE_TIMEOUT',
			message: `Unity did not finish compiling within ${Math.ceil(timeoutMs / 1_000)} seconds.`,
		},
	]);
}

async function finish(
	runner: UnityCommandRunner,
	details: UnityJsonDetails,
	state: UnityCompileDetails['state'],
	options: WaitForUnityCompileOptions,
	attempts: number,
	baselineCursor?: number,
	errors = details.errors,
	compileStatus?: string,
): Promise<UnityCompileDetails> {
	const console = await readUnityConsole(runner, {
		projectPath: options.projectPath,
		tail: 200,
		level: 'warn',
		...(baselineCursor === undefined ? {} : { since: baselineCursor }),
		signal: options.signal,
	});
	return {
		...details,
		ok: state === 'ready',
		state,
		attempts,
		...(compileStatus ? { compileStatus } : {}),
		errors,
		consoleEntries: console.entries,
		...(console.cursor === undefined ? {} : { consoleCursor: console.cursor }),
		compilationPending: false,
	};
}

function compileResult(data: unknown): {
	status?: string;
	failed: boolean;
	errors: UnityCliMessage[];
} {
	const outer = record(data);
	let result: unknown = outer?.result;
	if (typeof result === 'string') {
		try {
			result = JSON.parse(result);
		} catch {
			return { failed: false, errors: [] };
		}
	}
	const details = record(result);
	return {
		...(typeof details?.status === 'string' ? { status: details.status } : {}),
		failed: details?.failed === true,
		errors: Array.isArray(details?.errors)
			? details.errors
					.map(normalizeError)
					.filter((error) => error !== undefined)
			: [],
	};
}

function normalizeError(value: unknown): UnityCliMessage | undefined {
	if (typeof value === 'string') return unityDiagnostic(value);
	const error = record(value);
	if (!error) return;
	const message =
		typeof error.message === 'string' ? error.message : JSON.stringify(value);
	const diagnostic = unityDiagnostic(
		message,
		typeof error.code === 'string' ? error.code : undefined,
	);
	return {
		...diagnostic,
		...(typeof error.file === 'string' ? { file: error.file } : {}),
		...(positiveInteger(error.line) ? { line: error.line } : {}),
		...(positiveInteger(error.column) ? { column: error.column } : {}),
	};
}

function compileComplete(status: string | undefined): boolean {
	return status === 'completed' || status === 'up_to_date';
}

function failureState(
	details: UnityCommandDetails,
): UnityCompileDetails['state'] {
	return details.state === 'disconnected' || details.state === 'unavailable'
		? details.state
		: 'error';
}

function record(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === 'object'
		? (value as Record<string, unknown>)
		: undefined;
}

function positiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
	if (milliseconds <= 0 || signal?.aborted) return Promise.resolve();
	return new Promise((resolve) => {
		const done = () => {
			signal?.removeEventListener('abort', abort);
			resolve();
		};
		const timeout = setTimeout(done, milliseconds);
		timeout.unref();
		const abort = () => {
			clearTimeout(timeout);
			done();
		};
		signal?.addEventListener('abort', abort, { once: true });
	});
}
