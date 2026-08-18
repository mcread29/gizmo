import { runUnityJson, type UnityJsonDetails } from './unity-json';
import { sourceLocation } from './unity-diagnostics';
import type { UnityCommandRunner } from './unity-runner';

export type UnityConsoleLevel = 'log' | 'warn' | 'error';

export interface UnityConsoleEntry {
	seq?: number;
	timestamp?: string;
	level: UnityConsoleLevel;
	message: string;
	stackTrace?: string;
	file?: string;
	line?: number;
	column?: number;
}

export interface ReadUnityConsoleOptions {
	projectPath: string;
	tail?: number;
	level?: UnityConsoleLevel;
	since?: number;
	signal?: AbortSignal;
}

export interface UnityConsoleDetails extends UnityJsonDetails {
	state: 'completed' | 'disconnected' | 'unavailable' | 'error';
	entries: UnityConsoleEntry[];
	cursor?: number;
	dropped: boolean;
}

export async function readUnityConsole(
	runner: UnityCommandRunner,
	options: ReadUnityConsoleOptions,
): Promise<UnityConsoleDetails> {
	const args = [
		'--non-interactive',
		'--no-banner',
		'--format',
		'json',
		'command',
		'--project-path',
		options.projectPath,
		'console',
		'--',
		'--tail',
		String(options.tail ?? 100),
		'--level',
		options.level ?? 'log',
		...(options.since === undefined ? [] : ['--since', String(options.since)]),
	];
	const details = await runUnityJson(runner, args, { signal: options.signal });
	const result = commandResult(details.data);
	const entries = Array.isArray(result?.entries)
		? result.entries.map(consoleEntry).filter((entry) => entry !== undefined)
		: [];
	return {
		...details,
		state: details.ok
			? 'completed'
			: details.errors.some((error) =>
						error.message.toLowerCase().includes('no unity editor'),
				  )
				? 'disconnected'
				: details.errors.some((error) => error.code === 'UNITY_CLI_UNAVAILABLE')
					? 'unavailable'
					: 'error',
		entries,
		...(number(result?.cursor) === undefined
			? {}
			: { cursor: number(result?.cursor) }),
		dropped: result?.dropped === true,
	};
}

function consoleEntry(value: unknown): UnityConsoleEntry | undefined {
	const entry = record(value);
	if (!entry || typeof entry.message !== 'string') return;
	const level =
		entry.level === 'error' || entry.level === 'warn' ? entry.level : 'log';
	const stackTrace =
		typeof entry.stackTrace === 'string' ? entry.stackTrace : undefined;
	const location = sourceLocation(
		`${entry.message}${stackTrace ? `\n${stackTrace}` : ''}`,
	);
	return {
		...(number(entry.seq) === undefined ? {} : { seq: number(entry.seq) }),
		...(typeof entry.timestampUtc === 'string'
			? { timestamp: entry.timestampUtc }
			: {}),
		level,
		message: entry.message,
		...(stackTrace ? { stackTrace } : {}),
		...location,
	};
}

function commandResult(data: unknown): Record<string, unknown> | undefined {
	const outer = record(data);
	let result: unknown = outer?.result;
	if (typeof result === 'string') {
		try {
			result = JSON.parse(result);
		} catch {
			return;
		}
	}
	return record(result);
}

function record(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === 'object'
		? (value as Record<string, unknown>)
		: undefined;
}

function number(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value)
		? value
		: undefined;
}
