import type { ToolCallView } from '@unity-agent/protocol';
import type { Component } from 'svelte';

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
	/** Status pill shown in the inspector header, if this domain contributes one. */
	pill?: { state: string; label: string };
	/** A domain-owned tab in the workspace inspector, shown ahead of the generic tabs. */
	panel?: WorkspacePanel;
}
