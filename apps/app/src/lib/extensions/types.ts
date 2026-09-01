import type { ExtensionDescriptor, ToolCallView } from '@gizmo/protocol';
import type { Component } from 'svelte';
import type { AgentStore } from '../agent-client';

export interface ExtensionSettingsContext {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
}

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

/** What an extension needs to decide which inspector tabs to contribute. */
export interface InspectorTabContext {
	store: AgentStore;
	projectPath?: string;
	toolActivity: ToolCallView[];
}

export interface CommandContribution {
	id: string;
	label: string;
	keywords?: string[];
	icon?: Component;
	run(): void;
}

/** What an extension needs to decide which commands to contribute. */
export interface CommandContext {
	store: AgentStore;
	projectPath?: string;
}

export interface StatusBarContribution {
	id: string;
	label: string;
	icon?: Component;
	tone?: 'default' | 'accent' | 'danger';
	onClick?(): void;
}

/** What an extension needs to decide which status bar items to contribute. */
export interface StatusBarContext {
	store: AgentStore;
	projectPath?: string;
}

export interface WebExtensionRuntime {
	readonly inspectorTabs: InspectorTabContribution[];
	dispose(): void;
}

/**
 * A self-contained UI integration, discovered and loaded by id. Every
 * capability is optional — an extension contributes whichever of these it
 * actually has: settings/confirmation UI, inspector tabs, live RPC-style
 * operations activated against a project extension descriptor, or tool-result
 * presentation (labels, icons, custom renderers).
 */
export interface GizmoWebExtension {
	id: string;
	dialog?: Component<{
		store: AgentStore;
		settings: ExtensionSettingsContext;
	}>;
	settings?: Component<{ settings: ExtensionSettingsContext }>;
	/** Whether this extension runs a project process worth polling status/watch for. */
	hasProjectStatus?: boolean;

	/** Matched against a server-reported ExtensionDescriptor to activate live operations. */
	apiVersion?: number;
	activate?(
		descriptor: ExtensionDescriptor,
		context: ExtensionContext,
	): WebExtensionRuntime;

	/**
	 * Static tabs contributed to the workspace inspector while the extension is
	 * enabled — no project-runtime activation required.
	 */
	inspectorTabs?(context: InspectorTabContext): InspectorTabContribution[];

	/**
	 * Commands contributed to the global command palette (Cmd/Ctrl+K),
	 * alongside the app's own. Static like `inspectorTabs` — no per-project
	 * activation required.
	 */
	commands?(context: CommandContext): CommandContribution[];

	/**
	 * A small always-visible indicator in the titlebar, alongside the app's
	 * own project status. Static like `commands`/`inspectorTabs` — no
	 * per-project activation required.
	 */
	statusBar?(context: StatusBarContext): StatusBarContribution[];

	labels?: Record<string, string>;
	iconFor?(name: string): string | undefined;
	consoleEntriesKey?(name: string): string | undefined;
	parametersFor?(
		name: string,
		parameters: [string, string][],
	): [string, string][];
	resultFor?(name: string):
		| Component<{
				tool: ToolCallView;
				projectPath?: string;
				consoleEntries: unknown[];
				errors: unknown[];
		  }>
		| undefined;
	diagnosticsComponent?: Component<{ errors: unknown[]; projectPath?: string }>;
}
