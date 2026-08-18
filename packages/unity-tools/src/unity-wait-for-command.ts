import { executeUnityCommand, type UnityCommandDetails } from './unity-command';
import {
	listUnityCommands,
	type UnityRegisteredCommand,
} from './unity-list-commands';
import type { UnityCliMessage, UnityJsonDetails } from './unity-json';
import type { UnityCommandRunner } from './unity-runner';

export interface WaitForUnityCommandOptions {
	projectPath: string;
	command: string;
	timeoutMs?: number;
	pollIntervalMs?: number;
	signal?: AbortSignal;
	onProgress?: (message: string) => void;
}

export interface UnityCommandReloadDetails extends UnityJsonDetails {
	state:
		| 'ready'
		| 'compile_failed'
		| 'command_missing'
		| 'disconnected'
		| 'unavailable'
		| 'timeout'
		| 'error';
	expectedCommand: string;
	attempts: number;
	compileStatus?: string;
	registeredCommand?: UnityRegisteredCommand;
}

export async function waitForUnityCommand(
	runner: UnityCommandRunner,
	options: WaitForUnityCommandOptions,
): Promise<UnityCommandReloadDetails> {
	const startedAt = performance.now();
	const timeoutMs = options.timeoutMs ?? 120_000;
	const pollIntervalMs = options.pollIntervalMs ?? 750;
	let attempts = 0;
	options.onProgress?.('Requesting Unity script recompile');
	let last: UnityCommandDetails = await executeUnityCommand(runner, {
		projectPath: options.projectPath,
		command: 'recompile',
		signal: options.signal,
	});
	if (!last.ok) return failureFrom(last, options.command, attempts);
	options.onProgress?.('Waiting for Unity compilation and domain reload');

	while (performance.now() - startedAt < timeoutMs) {
		if (options.signal?.aborted) {
			return finish(last, 'error', options.command, attempts, [
				{ code: 'UNITY_CLI_ABORTED', message: 'Unity reload was cancelled.' },
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
					last,
					'compile_failed',
					options.command,
					attempts,
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
				options.onProgress?.(`Verifying ${options.command} registration`);
				const catalog = await listUnityCommands(runner, {
					projectPath: options.projectPath,
					signal: options.signal,
				});
				const registeredCommand = catalog.commands.find(
					(command) => command.name === options.command,
				);
				if (registeredCommand) {
					return {
						...catalog,
						state: 'ready',
						expectedCommand: options.command,
						attempts,
						compileStatus: compile.status,
						registeredCommand,
					};
				}
				return {
					...catalog,
					ok: false,
					state: catalog.ok
						? 'command_missing'
						: catalog.state === 'disconnected' ||
							  catalog.state === 'unavailable'
							? catalog.state
							: 'error',
					expectedCommand: options.command,
					attempts,
					compileStatus: compile.status,
					errors: catalog.ok
						? [
								...catalog.errors,
								{
									code: 'UNITY_COMMAND_NOT_REGISTERED_AFTER_RELOAD',
									message: `Unity finished compiling, but ${options.command} was not registered.`,
								},
							]
						: catalog.errors,
				};
			}
		}

		await wait(pollIntervalMs, options.signal);
	}

	return finish(last, 'timeout', options.command, attempts, [
		...last.errors,
		{
			code: 'UNITY_RELOAD_TIMEOUT',
			message: `Unity did not finish registering ${options.command} within ${Math.ceil(timeoutMs / 1_000)} seconds.`,
		},
	]);
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

function compileComplete(status: string | undefined): boolean {
	return status === 'completed' || status === 'up_to_date';
}

function failureFrom(
	details: UnityCommandDetails,
	expectedCommand: string,
	attempts: number,
): UnityCommandReloadDetails {
	const state =
		details.state === 'disconnected' || details.state === 'unavailable'
			? details.state
			: 'error';
	return finish(details, state, expectedCommand, attempts);
}

function finish(
	details: UnityJsonDetails,
	state: UnityCommandReloadDetails['state'],
	expectedCommand: string,
	attempts: number,
	errors = details.errors,
	compileStatus?: string,
): UnityCommandReloadDetails {
	return {
		...details,
		ok: state === 'ready',
		state,
		expectedCommand,
		attempts,
		...(compileStatus ? { compileStatus } : {}),
		errors,
	};
}

function normalizeError(value: unknown): UnityCliMessage | undefined {
	if (typeof value === 'string') {
		return { code: 'UNITY_COMPILE_ERROR', message: value };
	}
	const error = record(value);
	if (!error) return;
	const message =
		typeof error.message === 'string' ? error.message : JSON.stringify(value);
	return {
		code: typeof error.code === 'string' ? error.code : 'UNITY_COMPILE_ERROR',
		message,
	};
}

function record(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === 'object'
		? (value as Record<string, unknown>)
		: undefined;
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
