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
	UnityCommandParameter,
	UnityRegisteredCommand,
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
export { waitForUnityCommand } from './unity-wait-for-command';
export type {
	UnityCommandReloadDetails,
	WaitForUnityCommandOptions,
} from './unity-wait-for-command';
export { createUnityWaitForCommandTool } from './unity-wait-for-command-tool';
export type { UnityWaitForCommandToolOptions } from './unity-wait-for-command-tool';
export { unityCommandTemplate } from './unity-command-template';
export type {
	UnityCommandTemplate,
	UnityCommandTemplateOptions,
} from './unity-command-template';
export { createUnityCommandTemplateTool } from './unity-command-template-tool';

import { createUnityListCommandsTool } from './unity-list-commands-tool';
import { createUnityCommandTool } from './unity-command-tool';
import { createUnityCommandTemplateTool } from './unity-command-template-tool';
import { createUnityWaitForCommandTool } from './unity-wait-for-command-tool';
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
		createUnityWaitForCommandTool({
			...options,
			projectPath: options.projectPath ?? process.cwd(),
		}),
		createUnityCommandTemplateTool(),
	];
}

export const unityToolNames = [
	'unity_status',
	'unity_list_commands',
	'unity_command',
	'unity_wait_for_command',
	'unity_command_template',
] as const;
