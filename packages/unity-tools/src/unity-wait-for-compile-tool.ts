import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { UnityCompilationTracker } from './unity-compilation-tracker';
import { UnityRunner, type UnityCommandRunner } from './unity-runner';
import { waitForUnityCompile } from './unity-wait-for-compile';

export interface UnityWaitForCompileToolOptions {
	projectPath: string;
	runner?: UnityCommandRunner;
	tracker?: UnityCompilationTracker;
}

export function createUnityWaitForCompileTool(
	options: UnityWaitForCompileToolOptions,
) {
	const runner = options.runner ?? new UnityRunner();
	return defineTool({
		name: 'unity_wait_for_compile',
		label: 'Compile Unity project',
		description:
			'Force Unity to compile project scripts, wait through domain reload, and return compiler plus new console diagnostics. Use after changing Unity compilation inputs.',
		promptSnippet:
			'Compile Unity project scripts and return linked diagnostics',
		promptGuidelines: [
			'After changing C#, assembly definitions, compiler response files, or Packages/manifest.json, call unity_wait_for_compile before reporting success.',
			'Fix compiler errors and rerun the smallest relevant tests before finishing.',
		],
		parameters: Type.Object(
			{
				timeoutSeconds: Type.Optional(
					Type.Integer({ minimum: 10, maximum: 300 }),
				),
			},
			{ additionalProperties: false },
		),
		async execute(_toolCallId, params, signal, onUpdate) {
			const details = await waitForUnityCompile(runner, {
				projectPath: options.projectPath,
				timeoutMs: (params.timeoutSeconds ?? 120) * 1_000,
				signal,
				onProgress: (message) =>
					onUpdate?.({
						content: [{ type: 'text', text: message }],
						details: undefined,
					}),
			});
			if (details.ok) options.tracker?.clear();
			return {
				content: [
					{
						type: 'text',
						text: details.ok
							? `Unity compilation completed with ${details.consoleEntries.length} new warning or error entries.`
							: details.errors
									.map((error) => `${error.code}: ${error.message}`)
									.join('\n'),
					},
				],
				details,
			};
		},
	});
}
