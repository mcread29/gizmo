import type { Component } from 'svelte';
import ChangesPanel from './ChangesPanel.svelte';
import type { GitHostStore } from './host';

/**
 * A tab a web extension contributes to the workspace inspector. Mirrors the
 * app's `InspectorTabContribution`; kept local so the package never imports
 * the app.
 */
export interface GitInspectorTab {
	id: string;
	label: string;
	badge?: number;
	component: Component<any>;
	props: Record<string, unknown>;
}

/** Git's single entry point into Gizmo's generic web extension contract. */
export { patchFileName } from './thread-changes';
export const gizmoWebExtension = {
	id: 'git',
	name: 'Git',
	inspectorTabs(context: { store: GitHostStore }): GitInspectorTab[] {
		return [
			{
				id: 'git',
				label: 'Git',
				badge: context.store.gitStatus?.files.length ?? 0,
				component: ChangesPanel as Component<any>,
				props: {},
			},
		];
	},
};
