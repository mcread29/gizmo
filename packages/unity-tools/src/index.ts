export { UnityRunner } from './unity-runner';
export type {
	UnityCommandRunner,
	UnityRunnerOptions,
	UnityRunOptions,
	UnityRunResult,
} from './unity-runner';
export { runUnityJson } from './unity-json';
export type { UnityJsonDetails } from './unity-json';
export { executeUnityCommand } from './unity-command';
export type {
	ExecuteUnityCommandOptions,
	UnityCommandDetails,
} from './unity-command';
export { createUnityCommandTool } from './unity-command-tool';
export type { UnityCommandToolOptions } from './unity-command-tool';
export { listUnityProjects, openUnityProject } from './unity-projects';
export type {
	UnityOpenProjectDetails,
	UnityProject,
	UnityProjectsDetails,
} from './unity-projects';
export { listUnityCommands } from './unity-list-commands';
export type {
	UnityListCommandsDetails,
	UnityListCommandsOptions,
} from './unity-list-commands';
export { createUnityListCommandsTool } from './unity-list-commands-tool';
export type { UnityListCommandsToolOptions } from './unity-list-commands-tool';
export { getUnityStatus, unityStatusArgs } from './unity-status';
export type {
	UnityCliMessage,
	UnityEditorInstance,
	UnityStatusOptions,
	UnityStatusDetails,
} from './unity-status';
export { createUnityStatusTool } from './unity-status-tool';
export type { UnityToolOptions } from './unity-status-tool';

import { createUnityListCommandsTool } from './unity-list-commands-tool';
import { createUnityCommandTool } from './unity-command-tool';
import {
	createUnityStatusTool,
	type UnityToolOptions,
} from './unity-status-tool';

export function createUnityTools(options: UnityToolOptions = {}) {
	return [
		createUnityStatusTool(options),
		createUnityListCommandsTool(options),
		createUnityCommandTool({
			...options,
			projectPath: options.projectPath ?? process.cwd(),
		}),
	];
}

export const unityToolNames = [
	'unity_status',
	'unity_list_commands',
	'unity_command',
] as const;
