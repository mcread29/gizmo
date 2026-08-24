import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Bun runs these directly; anything else would need a shell or another runtime. */
const runnableExtensions = new Set([
	'.ts',
	'.tsx',
	'.js',
	'.mjs',
	'.cjs',
	'.mts',
	'.cts',
]);

const maxReportedChars = 20_000;
const defaultTimeoutSeconds = 60;

export interface RunScriptOptions {
	workspacePath: string;
	args?: readonly string[];
	timeoutSeconds?: number;
	signal?: AbortSignal;
	/** Injected in tests; defaults to invoking the real `bun` binary. */
	run?: ScriptRunner;
}

export type ScriptRunner = (
	command: string,
	args: string[],
	options: { cwd: string; timeout: number; signal?: AbortSignal },
) => Promise<{ stdout: string; stderr: string }>;

export interface RunScriptResult {
	script: string;
	ok: boolean;
	exitCode: number;
	stdout: string;
	stderr: string;
	truncated: boolean;
	timedOut: boolean;
}

/**
 * Runs one script file with Bun in a subprocess. There is deliberately no
 * shell: the path and arguments are passed as argv, so no interpolation,
 * pipes, redirection, or chained commands are possible. This is the only
 * execution primitive Gizmo exposes — see docs/extensions.md.
 */
export async function runScript(
	scriptPath: string,
	options: RunScriptOptions,
): Promise<RunScriptResult> {
	const workspacePath = resolve(options.workspacePath);
	const absolute = resolve(workspacePath, scriptPath);
	if (absolute !== workspacePath && !absolute.startsWith(`${workspacePath}/`)) {
		throw new Error(`Script must be inside the workspace: ${scriptPath}`);
	}
	const extension = extname(absolute).toLowerCase();
	if (!runnableExtensions.has(extension)) {
		throw new Error(
			`Only TypeScript and JavaScript files can be run (got "${extension || scriptPath}"). Shell scripts are not supported.`,
		);
	}
	const info = await stat(absolute).catch(() => undefined);
	if (!info?.isFile()) throw new Error(`No such script: ${scriptPath}`);

	const args = [...(options.args ?? [])];
	if (args.some((argument) => typeof argument !== 'string')) {
		throw new Error('Script arguments must be strings');
	}
	const timeoutSeconds = options.timeoutSeconds ?? defaultTimeoutSeconds;
	const run = options.run ?? bunRunner;
	const script = relative(workspacePath, absolute);

	try {
		const { stdout, stderr } = await run('bun', ['run', absolute, ...args], {
			cwd: workspacePath,
			timeout: timeoutSeconds * 1000,
			...(options.signal ? { signal: options.signal } : {}),
		});
		return report({ script, exitCode: 0, stdout, stderr, timedOut: false });
	} catch (error) {
		if (isMissingBun(error)) {
			throw new Error(
				'Bun is required to run scripts but was not found on PATH.',
			);
		}
		const failure = error as {
			code?: number | string;
			killed?: boolean;
			signal?: string;
			stdout?: string;
			stderr?: string;
			message?: string;
		};
		const timedOut =
			failure.killed === true || failure.signal === 'SIGTERM';
		const overflowed =
			typeof failure.code === 'string' &&
			failure.code.toLowerCase().includes('maxbuffer');
		return report({
			script,
			exitCode: typeof failure.code === 'number' ? failure.code : 1,
			stdout: failure.stdout ?? '',
			stderr:
				failure.stderr ??
				(overflowed
					? 'Output exceeded the capture limit and was truncated.'
					: failure.message ?? ''),
			timedOut,
			truncated: overflowed,
		});
	}
}

function report(
	result: Omit<RunScriptResult, 'ok' | 'truncated'> & { truncated?: boolean },
): RunScriptResult {
	const stdout = clamp(result.stdout);
	const stderr = clamp(result.stderr);
	return {
		...result,
		stdout: stdout.text,
		stderr: stderr.text,
		ok: result.exitCode === 0 && !result.timedOut,
		truncated:
			result.truncated === true ||
			stdout.truncated ||
			stderr.truncated,
	};
}

function clamp(text: string): { text: string; truncated: boolean } {
	if (text.length <= maxReportedChars) return { text, truncated: false };
	return {
		text: `${text.slice(0, maxReportedChars)}\n… output truncated`,
		truncated: true,
	};
}

function isMissingBun(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === 'ENOENT'
	);
}

const bunRunner: ScriptRunner = (command, args, options) =>
	execFileAsync(command, args, {
		cwd: options.cwd,
		encoding: 'utf8',
		timeout: options.timeout,
		// Generous byte cap: execFile kills the process at maxBuffer, which
		// reports as an error rather than clamped output. 4x the reported-char
		// cap leaves room for multi-byte UTF-8 while still bounding memory.
		maxBuffer: maxReportedChars * 4,
		...(options.signal ? { signal: options.signal } : {}),
		// No shell, and no inherited stdin: the script cannot prompt for input.
		shell: false,
	});
