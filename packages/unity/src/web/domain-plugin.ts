import type {
	ConversationMessage,
	StoredProject,
	UnityStatus,
} from '@gizmo/protocol';
import UnityDomainDialog from './UnityDomainDialog.svelte';
import UnityDomainSettings from './UnityDomainSettings.svelte';
import UnityPanel from './unity/UnityPanel.svelte';
import { createUnityView } from './unity/unity-view';

export interface UnityDomainStore {
	messages: ConversationMessage[];
	projects: StoredProject[];
	selectedProjectPath?: string;
	projectStatus?: UnityStatus;
	projectsLoading: boolean;
	openSelectedProject(): void;
	refreshProjectStatus(): void;
}

/** Unity's contribution to Gizmo's generic workspace-view/domain-plugin contract. */
export const unityDomainPlugin = {
	id: 'unity',
	dialog: UnityDomainDialog,
	settings: UnityDomainSettings,
	hasProjectStatus: true,
	createView(store: UnityDomainStore) {
		const view = createUnityView({
			messages: store.messages,
			projects: store.projects,
			selectedProjectPath: store.selectedProjectPath,
			projectStatus: store.projectStatus,
			projectsLoading: store.projectsLoading,
		});
		return {
			domainId: 'unity',
			workspacePath: view.projectPath,
			workspaceName: view.projectName,
			subtitle: view.version ? `Unity ${view.version}` : view.state,
			state: view.status?.state,
			toolActivity: view.toolActivity,
			canOpen: Boolean(view.selectedProject && !view.editor),
			open: () => store.openSelectedProject(),
			refresh: () => store.refreshProjectStatus(),
			pill: view.lifecycle,
			panel: {
				id: 'unity',
				label: 'Unity',
				component: UnityPanel,
				props: { view, store, onOpenProject: () => store.openSelectedProject() },
			},
		};
	},
};
