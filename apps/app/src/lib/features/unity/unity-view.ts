import type {
	ConversationMessage,
	ToolCallView,
	UnityProject,
	UnityStatus,
} from '@unity-agent/protocol';

export interface UnityCommandsView {
	state: 'available' | 'disconnected' | 'unavailable' | 'error';
	commands: unknown[];
	errors: { code: string; message: string }[];
}

export interface UnityView {
	selectedProject?: UnityProject;
	status?: UnityStatus;
	commands?: UnityCommandsView;
	commandNames: string[];
	editor?: Record<string, unknown>;
	projectPath?: string;
	projectName: string;
	version?: string;
	state: string;
	toolActivity: ToolCallView[];
}

interface UnityViewInput {
	messages: ConversationMessage[];
	projects: UnityProject[];
	selectedProjectPath?: string;
	projectStatus?: UnityStatus;
	projectsLoading: boolean;
}

export function createUnityView(input: UnityViewInput): UnityView {
	const toolActivity = input.messages.flatMap((message) => message.tools);
	const selectedProject = input.projects.find(
		(project) => project.path === input.selectedProjectPath,
	);
	const status = input.projectStatus ?? findUnityStatus(toolActivity);
	const commands = findUnityCommands(toolActivity);
	const editor = status?.instances[0];
	const projectPath =
		readEditorValue(editor, ['projectPath', 'project']) ??
		selectedProject?.path;
	const projectNameValue =
		selectedProject?.title ??
		readEditorValue(editor, ['projectName', 'name']) ??
		projectName(projectPath) ??
		(input.projectsLoading ? 'Loading projects' : 'Select a project');
	const version =
		readEditorValue(editor, ['version', 'unityVersion']) ??
		selectedProject?.version;
	const state =
		readEditorValue(editor, ['state', 'connectionState']) ??
		statusLabel(status?.state);

	return {
		...(selectedProject ? { selectedProject } : {}),
		...(status ? { status } : {}),
		...(commands ? { commands } : {}),
		commandNames:
			commands?.commands
				.map(commandName)
				.filter((name): name is string => name !== undefined) ?? [],
		...(editor ? { editor } : {}),
		...(projectPath ? { projectPath } : {}),
		projectName: projectNameValue,
		...(version ? { version } : {}),
		state,
		toolActivity,
	};
}

export function readEditorValue(
	instance: Record<string, unknown> | undefined,
	keys: string[],
): string | undefined {
	if (!instance) return;
	for (const key of keys) {
		const value = instance[key];
		if (typeof value === 'string' || typeof value === 'number') {
			return String(value);
		}
	}
}

export function statusLabel(state: UnityStatus['state'] | undefined): string {
	switch (state) {
		case 'connected':
			return 'Ready';
		case 'disconnected':
			return 'Disconnected';
		case 'unavailable':
			return 'CLI unavailable';
		case 'error':
			return 'Check failed';
		default:
			return 'Not checked';
	}
}

function findUnityStatus(tools: ToolCallView[]): UnityStatus | undefined {
	for (let index = tools.length - 1; index >= 0; index--) {
		const tool = tools[index];
		if (tool.name !== 'unity_status' || !isUnityStatus(tool.result)) continue;
		return tool.result;
	}
}

function isUnityStatus(value: unknown): value is UnityStatus {
	if (!value || typeof value !== 'object') return false;
	const state = 'state' in value ? value.state : undefined;
	return (
		(state === 'connected' ||
			state === 'disconnected' ||
			state === 'unavailable' ||
			state === 'error') &&
		'instances' in value &&
		Array.isArray(value.instances) &&
		'errors' in value &&
		Array.isArray(value.errors)
	);
}

function findUnityCommands(
	tools: ToolCallView[],
): UnityCommandsView | undefined {
	for (let index = tools.length - 1; index >= 0; index--) {
		const tool = tools[index];
		if (tool.name !== 'unity_list_commands' || !isUnityCommands(tool.result))
			continue;
		return tool.result;
	}
}

function isUnityCommands(value: unknown): value is UnityCommandsView {
	if (!value || typeof value !== 'object') return false;
	const state = 'state' in value ? value.state : undefined;
	return (
		(state === 'available' ||
			state === 'disconnected' ||
			state === 'unavailable' ||
			state === 'error') &&
		'commands' in value &&
		Array.isArray(value.commands) &&
		'errors' in value &&
		Array.isArray(value.errors)
	);
}

export function commandName(command: unknown): string | undefined {
	if (typeof command === 'string') return command;
	if (!command || typeof command !== 'object') return;
	const record = command as Record<string, unknown>;
	for (const key of ['name', 'command', 'id']) {
		if (typeof record[key] === 'string') return record[key];
	}
}

function projectName(path: string | undefined): string | undefined {
	return path?.split(/[\\/]/).filter(Boolean).at(-1);
}
