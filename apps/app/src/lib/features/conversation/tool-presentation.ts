import type { Component } from 'svelte';
import type { ToolCallView } from '@unity-agent/protocol';
import { unityToolPresentation } from '@unity-agent/unity/web';

export interface ToolPresentationPlugin {
	labels?: Record<string, string>;
	iconFor?(name: string): string | undefined;
	consoleEntriesKey?(name: string): string | undefined;
	resultFor?(
		name: string,
	): Component<{
		tool: ToolCallView;
		projectPath?: string;
		consoleEntries: unknown[];
		errors: unknown[];
	}> | undefined;
	diagnosticsComponent?: Component<{ errors: unknown[]; projectPath?: string }>;
}

export const toolPresentationPlugins: readonly ToolPresentationPlugin[] = [
	unityToolPresentation,
];
