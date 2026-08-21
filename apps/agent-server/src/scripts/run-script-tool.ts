import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
	runScript,
	type RunScriptResult,
	type ScriptRunner,
} from './run-script';

export interface RunScriptToolOptions {
	workspacePath: string;
	run?: ScriptRunner;
}

/**
 * Gizmo's only execution primitive. It runs a single `.ts`/`.js` file with
 * Bun — there is no shell, so skills that ship `.sh` scripts do not work here
 * by design. See docs/extensions.md.
 */
export function createRunScriptTool(options: RunScriptToolOptions) {
	return defineTool({
		name: 'run_script',
		label: 'Run script',
		description:
			'Run one TypeScript or JavaScript file from the current workspace with Bun. Use this for scripts that ship with a skill, or for a script you have just written. There is no shell: the file path and arguments are passed directly, so pipes, redirection, environment assignments, and chained commands are unavailable. Shell scripts cannot be run.',
		promptSnippet: 'Run a workspace TypeScript or JavaScript file with Bun',
		promptGuidelines: [
			'Pass the script path relative to the workspace root; it must stay inside the workspace.',
			'Pass arguments as separate array entries, never as one shell-quoted string.',
			'Write a .ts file first if the work needs scripting; do not expect bash to be available.',
		],
		parameters: Type.Object(
			{
				script: Type.String({ minLength: 1, maxLength: 4096 }),
				args: Type.Optional(
					Type.Array(Type.String({ maxLength: 4096 }), { maxItems: 64 }),
				),
				timeoutSeconds: Type.Optional(
					Type.Integer({ minimum: 1, maximum: 600 }),
				),
			},
			{ additionalProperties: false },
		),
		async execute(_toolCallId, params, signal) {
			const details = await runScript(params.script, {
				workspacePath: options.workspacePath,
				...(params.args ? { args: params.args } : {}),
				...(params.timeoutSeconds
					? { timeoutSeconds: params.timeoutSeconds }
					: {}),
				...(options.run ? { run: options.run } : {}),
				signal,
			});
			return {
				content: [{ type: 'text' as const, text: summarize(details) }],
				details,
			};
		},
	});
}

function summarize(details: RunScriptResult): string {
	const sections = [
		details.stdout.trim() && `stdout:\n${details.stdout.trim()}`,
		details.stderr.trim() && `stderr:\n${details.stderr.trim()}`,
	].filter(Boolean);
	const status = details.timedOut
		? `${details.script} timed out`
		: details.ok
			? `${details.script} exited 0`
			: `${details.script} exited ${details.exitCode}`;
	return [status, ...sections].join('\n\n');
}
