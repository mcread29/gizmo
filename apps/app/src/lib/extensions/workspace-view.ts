import type { AgentStore } from '../agent-client';
import { extension } from './registry';
import type { WorkspaceView } from './types';

export function createWorkspaceView(store: AgentStore): WorkspaceView {
	const domainId = store.activeDomains.find((id) => extension(id)?.createView);
	const active = domainId ? extension(domainId) : undefined;
	if (active?.createView) return active.createView(store);

	const workspacePath = store.selectedProjectPath;
	const toolActivity = store.messages.flatMap(({ tools }) => tools);
	return {
		...(store.activeDomains.includes('svelte') ? { domainId: 'svelte' } : {}),
		...(workspacePath ? { workspacePath } : {}),
		workspaceName: nameFromPath(workspacePath) ?? 'Select a workspace',
		subtitle: store.activeDomains.includes('svelte') ? 'Svelte' : 'Workspace',
		state: store.connection,
		toolActivity,
		canOpen: false,
		open: () => {},
		refresh: () => {},
	};
}

function nameFromPath(path: string | undefined): string | undefined {
	return path?.split(/[\\/]/).filter(Boolean).at(-1);
}
