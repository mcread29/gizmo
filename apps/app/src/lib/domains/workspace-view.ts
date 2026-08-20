import type { AgentStore } from '../agent-client';
import { createUnityView, type UnityView } from '../features/unity/unity-view';
import type { WorkspaceView } from './types';

export type ActiveWorkspaceView = WorkspaceView & { unity?: UnityView };

export function createWorkspaceView(store: AgentStore): ActiveWorkspaceView {
	const workspacePath = store.selectedProjectPath;
	if (
		store.activeDomains.includes('unity') ||
		store.projects.some(
			({ path, domainId }) => path === workspacePath && domainId === 'unity',
		)
	) {
		const unity = createUnityView({
			messages: store.messages,
			projects: store.projects,
			selectedProjectPath: workspacePath,
			projectStatus: store.projectStatus,
			projectsLoading: store.projectsLoading,
		});
		return {
			domainId: 'unity',
			workspacePath: unity.projectPath,
			workspaceName: unity.projectName,
			subtitle: unity.version ? `Unity ${unity.version}` : unity.state,
			state: unity.status?.state,
			toolActivity: unity.toolActivity,
			canOpen: Boolean(unity.selectedProject && !unity.editor),
			open: () => void store.openSelectedProject(),
			refresh: () => void store.refreshProjectStatus(),
			unity,
		};
	}

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
