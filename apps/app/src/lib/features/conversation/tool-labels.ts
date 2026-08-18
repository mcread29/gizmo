const labels: Record<string, string> = {
	unity_status: 'Unity Editor status',
	unity_list_commands: 'Unity commands',
	unity_command: 'Unity command',
	unity_console: 'Unity console',
	unity_wait_for_compile: 'Compile Unity project',
	unity_wait_for_command: 'Reload Unity commands',
	unity_test: 'Unity tests',
	unity_script: 'Unity TypeScript',
	unity_command_template: 'Unity command template',
	read: 'Read file',
	edit: 'Edit file',
	write: 'Write file',
};

export function toolLabel(name: string): string {
	return labels[name] ?? name;
}

export type ToolIcon = 'unity' | 'file' | 'shell';

export function toolIcon(name: string): ToolIcon {
	if (name.startsWith('unity_')) return 'unity';
	if (name === 'read' || name === 'edit' || name === 'write') return 'file';
	return 'shell';
}
