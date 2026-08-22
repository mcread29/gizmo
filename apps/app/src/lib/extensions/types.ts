import type { ExtensionDescriptor, ToolCallView } from '@gizmo/protocol';
import type { Component } from 'svelte';
import type { AgentStore } from '../agent-client';
import type { WorkspaceLayout } from '../features/shell/workspace.svelte';

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

export interface WebExtensionRuntime {
	readonly inspectorTabs: InspectorTabContribution[];
	dispose(): void;
}

export interface WorkspacePanel {
	id: string;
	label: string;
	component: Component<any>;
	props: Record<string, unknown>;
}

export interface WorkspaceView {
	domainId?: string;
	workspacePath?: string;
	workspaceName: string;
	subtitle: string;
	state?: string;
	toolActivity: ToolCallView[];
	canOpen: boolean;
	open(): void;
	refresh(): void;
	/** Status pill shown in the inspector header, if this extension contributes one. */
	pill?: { state: string; label: string };
	/** An extension-owned tab in the workspace inspector, shown ahead of the generic tabs. */
	panel?: WorkspacePanel;
}

/**
 * A self-contained UI integration, discovered and loaded by id. Every
 * capability is optional — an extension contributes whichever of these it
 * actually has: a settings/confirmation dialog, a workspace view/panel, live
 * RPC-style operations activated against a project extension descriptor, or
 * tool-result presentation (labels, icons, custom renderers).
 */
export interface GizmoWebExtension {
	id: string;
	dialog?: Component<{ store: AgentStore; layout: WorkspaceLayout }>;
	settings?: Component<{ layout: WorkspaceLayout }>;
	createView?(store: AgentStore): WorkspaceView;
	/** Whether this extension runs a project process worth polling status/watch for. */
	hasProjectStatus?: boolean;

	/** Matched against a server-reported ExtensionDescriptor to activate live operations. */
	apiVersion?: number;
	activate?(
		descriptor: ExtensionDescriptor,
		context: ExtensionContext,
	): WebExtensionRuntime;

	/**
	 * Static tabs contributed to the workspace inspector whenever the
	 * extension is installed — no per-project activation required.
	 */
	inspectorTabs?(context: InspectorTabContext): InspectorTabContribution[];

	/**
	 * Commands contributed to the global command palette (Cmd/Ctrl+K),
	 * alongside the app's own. Static like `inspectorTabs` — no per-project
	 * activation required.
	 */
	commands?(context: CommandContext): CommandContribution[];

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
