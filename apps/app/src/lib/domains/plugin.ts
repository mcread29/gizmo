import type { Component } from 'svelte';
import type { AgentStore } from '../agent-client';
import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
import type { WorkspaceView } from './types';

/** A self-contained UI integration for one kind of workspace, mirroring the server's WorkspaceDomain. */
export interface DomainPlugin {
	id: string;
	dialog?: Component<{ store: AgentStore; layout: WorkspaceLayout }>;
	settings?: Component<{ layout: WorkspaceLayout }>;
	createView?(store: AgentStore): WorkspaceView;
	/** Whether this domain runs a project process worth polling status/watch for. */
	hasProjectStatus?: boolean;
}
