import { extensionUi } from '../../extensions/extension-ui.svelte';

const baseLabels: Record<string, string> = {
	read: 'Read file',
	edit: 'Edit file',
	write: 'Write file',
};

export function toolLabel(name: string): string {
	// Read per call rather than built once: the catalog is re-fetched whenever
	// the workspace or the server's extensions change.
	return extensionUi.labelFor(name) ?? baseLabels[name] ?? name;
}

export type ToolIcon = 'file' | 'shell' | string;

export function toolIcon(name: string): ToolIcon {
	const contributed = extensionUi.iconFor(name);
	if (contributed) return contributed;
	if (name === 'read' || name === 'edit' || name === 'write') return 'file';
	return 'shell';
}
