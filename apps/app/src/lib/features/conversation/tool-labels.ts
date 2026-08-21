import { webExtensions as toolPresentationPlugins } from '../../extensions/registry.svelte';

const baseLabels: Record<string, string> = {
	read: 'Read file',
	edit: 'Edit file',
	write: 'Write file',
};

// Read per call rather than built once: extensions can be installed after
// this module is first evaluated.
function labels(): Record<string, string> {
	return Object.assign(
		{},
		baseLabels,
		...toolPresentationPlugins().map((plugin) => plugin.labels ?? {}),
	);
}

export function toolLabel(name: string): string {
	return labels()[name] ?? name;
}

export type ToolIcon = 'file' | 'shell' | string;

export function toolIcon(name: string): ToolIcon {
	for (const plugin of toolPresentationPlugins()) {
		const icon = plugin.iconFor?.(name);
		if (icon) return icon;
	}
	if (name === 'read' || name === 'edit' || name === 'write') return 'file';
	return 'shell';
}
