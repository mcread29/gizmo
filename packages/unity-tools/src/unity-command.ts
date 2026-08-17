import { runUnityJson, type UnityJsonDetails } from './unity-json';
import {
	listUnityCommands,
	type UnityListCommandsDetails,
} from './unity-list-commands';
import type { UnityCommandRunner } from './unity-runner';

const globalJsonArgs = [
	'--non-interactive',
	'--no-banner',
	'--format',
	'json',
] as const;

export interface ExecuteUnityCommandOptions {
	projectPath: string;
	command: string;
	args?: readonly string[];
	timeoutSeconds?: number;
	signal?: AbortSignal;
}

export interface UnityCommandDetails extends UnityJsonDetails {
	state:
		'completed' | 'disconnected' | 'unavailable' | 'unregistered' | 'error';
	editorCommand: string;
	args: readonly string[];
}

export async function executeUnityCommand(
	runner: UnityCommandRunner,
	options: ExecuteUnityCommandOptions,
): Promise<UnityCommandDetails> {
	const listed = await listUnityCommands(runner, {
		projectPath: options.projectPath,
		signal: options.signal,
	});
	if (!listed.ok) return listingFailure(listed, options);
	if (
		!listed.commands.some((command) => commandName(command) === options.command)
	) {
		return {
			...listed,
			ok: false,
			state: 'unregistered',
			data: null,
			editorCommand: options.command,
			args: options.args ?? [],
			errors: [
				...listed.errors,
				{
					code: 'UNITY_COMMAND_NOT_REGISTERED',
					message: `The connected Editor has not registered ${options.command}.`,
				},
			],
		};
	}

	const timeoutSeconds = options.timeoutSeconds ?? 30;
	const args = options.args ?? [];
	const result = await runUnityJson(
		runner,
		[
			...globalJsonArgs,
			'command',
			'--project-path',
			options.projectPath,
			'--timeout',
			String(timeoutSeconds),
			options.command,
			...(args.length ? ['--', ...args] : []),
		],
		{
			signal: options.signal,
			timeoutMs: (timeoutSeconds + 5) * 1_000,
		},
	);
	return {
		...result,
		state: result.ok
			? 'completed'
			: result.errors.some((error) => error.code === 'UNITY_CLI_UNAVAILABLE')
				? 'unavailable'
				: 'error',
		editorCommand: options.command,
		args,
	};
}

function listingFailure(
	listed: UnityListCommandsDetails,
	options: ExecuteUnityCommandOptions,
): UnityCommandDetails {
	return {
		...listed,
		state:
			listed.state === 'disconnected' || listed.state === 'unavailable'
				? listed.state
				: 'error',
		editorCommand: options.command,
		args: options.args ?? [],
	};
}

function commandName(command: unknown): string | undefined {
	if (typeof command === 'string') return command;
	if (!command || typeof command !== 'object') return;
	return 'name' in command && typeof command.name === 'string'
		? command.name
		: undefined;
}
