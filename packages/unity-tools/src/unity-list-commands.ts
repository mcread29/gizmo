import { runUnityJson, type UnityJsonDetails } from './unity-json';
import type { UnityCommandRunner } from './unity-runner';

const globalJsonArgs = [
	'--non-interactive',
	'--no-banner',
	'--format',
	'json',
] as const;

export interface UnityListCommandsOptions {
	projectPath?: string;
	signal?: AbortSignal;
}

export interface UnityListCommandsDetails extends UnityJsonDetails {
	state: 'available' | 'disconnected' | 'unavailable' | 'error';
	commands: unknown[];
}

export async function listUnityCommands(
	runner: UnityCommandRunner,
	options: UnityListCommandsOptions = {},
): Promise<UnityListCommandsDetails> {
	const args = [
		...globalJsonArgs,
		'list',
		...(options.projectPath ? ['--project-path', options.projectPath] : []),
	];
	const result = await runUnityJson(runner, args, { signal: options.signal });
	return {
		...result,
		state: result.ok
			? 'available'
			: result.errors.some((error) =>
						error.message.includes('No Unity Editor instances'),
				  )
				? 'disconnected'
				: result.errors.some((error) => error.code === 'UNITY_CLI_UNAVAILABLE')
					? 'unavailable'
					: 'error',
		commands: extractCommands(result.data),
	};
}

function extractCommands(data: unknown): unknown[] {
	if (Array.isArray(data)) return data;
	if (!data || typeof data !== 'object') return [];
	if ('commands' in data && Array.isArray(data.commands)) return data.commands;
	if ('tools' in data && Array.isArray(data.tools)) return data.tools;
	return [];
}
