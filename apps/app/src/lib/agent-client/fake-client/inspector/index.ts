import { registerWebExtensions } from '../../../extensions/registry.svelte';
import type { GizmoWebExtension } from '../../../extensions/types';
import { fakeConsoleEntries } from '../fixtures';
import FakeChangesPanel from './FakeChangesPanel.svelte';
import FakeConsolePanel from './FakeConsolePanel.svelte';
import FakeDocsPanel from './FakeDocsPanel.svelte';

/*
 * Inspector tabs only ever come from runtime-loaded extension bundles, which
 * the fake agent has none of — so `?fake` used to open on an empty rail and
 * the inspector could not be worked on without the real sidecar and registry
 * running. These stand-ins register straight into the web-extension registry
 * instead of going through the bundle loader: the loader's job is evaluating
 * untrusted source, and there is nothing to prove about that here.
 *
 * Their ids match the seeded project integrations, so enabling and disabling
 * them in Configure adds and removes tabs exactly as the real ones do.
 */
const fakeWebExtensions: GizmoWebExtension[] = [
	{
		id: 'unity',
		inspectorTabs: () => [
			{
				id: 'unity.console',
				label: 'Console',
				component: FakeConsolePanel,
				props: {},
				badge: fakeConsoleEntries.filter(({ level }) => level === 'error')
					.length,
				badgeTone: 'danger',
			},
		],
	},
	{
		id: 'git',
		inspectorTabs: () => [
			{
				id: 'git.changes',
				label: 'Changes',
				component: FakeChangesPanel,
				props: {},
			},
		],
	},
	{
		id: 'svelte',
		inspectorTabs: () => [
			{ id: 'svelte.docs', label: 'Docs', component: FakeDocsPanel, props: {} },
		],
	},
];

/** Dev-only: never reached from a production bundle. */
export function installFakeWebExtensions(): void {
	registerWebExtensions(fakeWebExtensions);
}
