import type { ExtensionDescriptor } from '@gizmo/protocol';
import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { AgentStore } from '../../../src/lib/agent-client';
import TestExtensionPanel from './fixtures/TestExtensionPanel.svelte';
import WorkspaceInspector from '../../../src/lib/extensions/WorkspaceInspector.svelte';
import { registerWebExtensions } from '../../../src/lib/extensions/registry.svelte.ts';
import type { WorkspaceView } from '../../../src/lib/extensions/types';

const view: WorkspaceView = {
	domainId: 'test-domain',
	workspacePath: '/projects/game',
	workspaceName: 'game',
	subtitle: 'Test domain',
	toolActivity: [],
	canOpen: false,
	open: () => {},
	refresh: () => {},
	panel: {
		id: 'test-domain',
		label: 'Test domain',
		component: TestExtensionPanel,
		props: {},
	},
};

function store(projectExtensions: ExtensionDescriptor[]): AgentStore {
	return {
		messages: [],
		projectExtensions,
		activeDomains: projectExtensions.map(({ id }) => id),
		projectOpening: false,
		invokeProjectExtension: async () => ({
			state: 'ready',
			revision: '1',
			counts: { logs: 0, warnings: 0, errors: 0 },
			entries: [],
		}),
	} as unknown as AgentStore;
}

describe('WorkspaceInspector', () => {
	it("renders a domain's contributed panel and the extension tabs it activates", async () => {
		const fallback = render(WorkspaceInspector, {
			store: store([]),
			view,
			hidden: false,
		});
		expect(
			fallback.container.querySelector('[data-ui="test-domain-panel-tab"]'),
		).toBeNull();

		registerWebExtensions([
			{
				id: 'unity',
				apiVersion: 1,
				activate: () => ({
					inspectorTabs: [
						{
							id: 'console',
							label: 'Console',
							component: TestExtensionPanel,
							props: { extensionTabs: [] },
						},
					],
					dispose: () => {},
				}),
			},
		]);
		const extras = render(WorkspaceInspector, {
			store: store([
				{
					id: 'unity',
					name: 'Unity',
					version: '0.1.0',
					apiVersion: 1,
					capabilities: ['unity.console'],
					operations: [
						{
							id: 'console.snapshot',
							mutates: false,
							requiresConfirmation: false,
						},
					],
				},
			]),
			view,
			hidden: false,
		});
		await waitFor(() =>
			expect(
				extras.container.querySelector('[data-ui="test-domain-panel-tab"]'),
			).toBeTruthy(),
		);
		fallback.unmount();
		extras.unmount();
	});
});
