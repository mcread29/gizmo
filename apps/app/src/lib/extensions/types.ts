import type { UnityExtensionDescriptor } from '@unity-agent/protocol';
import type { Component } from 'svelte';

export interface ExtensionContext {
	projectPath: string;
	invoke(operation: string, input?: unknown): Promise<unknown>;
}

export interface ExtensionHostContext {
	projectPath: string;
	invoke(
		extensionId: string,
		operation: string,
		input?: unknown,
	): Promise<unknown>;
}

export interface InspectorTabContribution {
	id: string;
	label: string;
	shortLabel?: string;
	badge?: number;
	badgeTone?: 'accent' | 'danger';
	component: Component<any>;
	props: Record<string, unknown>;
}

export interface WebExtensionRuntime {
	readonly inspectorTabs: InspectorTabContribution[];
	dispose(): void;
}

export interface WebExtensionDefinition {
	id: string;
	apiVersion: number;
	activate(
		descriptor: UnityExtensionDescriptor,
		context: ExtensionContext,
	): WebExtensionRuntime;
}
