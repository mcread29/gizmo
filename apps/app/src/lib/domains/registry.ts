import type { Component } from 'svelte';
import type { AgentStore } from '../agent-client';
import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
import SvelteInspector from './SvelteInspector.svelte';
import UnityDomainDialog from './UnityDomainDialog.svelte';
import UnityDomainInspector from './UnityDomainInspector.svelte';
import UnityDomainSettings from './UnityDomainSettings.svelte';
import type { ActiveWorkspaceView } from './workspace-view';

export interface WebDomainDefinition {
	id: string;
	inspector: Component<{
		store: AgentStore;
		view: ActiveWorkspaceView;
		hidden: boolean;
		/** Collapses the inspector. Contributed to the panel's own header. */
		onCollapse?: () => void;
	}>;
	dialog?: Component<{ store: AgentStore; layout: WorkspaceLayout }>;
	settings?: Component<{ layout: WorkspaceLayout }>;
}

export const webDomains: readonly WebDomainDefinition[] = [
	{
		id: 'unity',
		inspector: UnityDomainInspector,
		dialog: UnityDomainDialog,
		settings: UnityDomainSettings,
	},
	{ id: 'svelte', inspector: SvelteInspector },
];

export function webDomain(
	id: string | undefined,
): WebDomainDefinition | undefined {
	return webDomains.find((domain) => domain.id === id);
}
