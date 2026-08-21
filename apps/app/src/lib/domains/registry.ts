import type { Component } from 'svelte';
import type { AgentStore } from '../agent-client';
import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
import UnityDomainDialog from './UnityDomainDialog.svelte';
import UnityDomainSettings from './UnityDomainSettings.svelte';

export interface WebDomainDefinition {
	id: string;
	dialog?: Component<{ store: AgentStore; layout: WorkspaceLayout }>;
	settings?: Component<{ layout: WorkspaceLayout }>;
}

export const webDomains: readonly WebDomainDefinition[] = [
	{ id: 'unity', dialog: UnityDomainDialog, settings: UnityDomainSettings },
	{ id: 'svelte' },
];

export function webDomain(
	id: string | undefined,
): WebDomainDefinition | undefined {
	return webDomains.find((domain) => domain.id === id);
}
