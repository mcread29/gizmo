import type { ExtensionDescriptor } from '@unity-agent/protocol';
import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { AgentStore } from '../agent-client';
import WorkspaceInspector from './WorkspaceInspector.svelte';
import type { ActiveWorkspaceView } from './workspace-view';

const view: ActiveWorkspaceView = {
	domainId: 'unity',
	workspacePath: '/projects/game',
	workspaceName: 'game',
	subtitle: 'Unity',
	toolActivity: [],
	canOpen: false,
	open: () => {},
	refresh: () => {},
	unity: {
		projectPath: '/projects/game',
		projectName: 'game',
		state: 'connected',
		lifecycle: { state: 'ready', label: 'Ready', errors: [], pendingPaths: [] },
		consoleDiagnostics: [],
		toolActivity: [],
	},
};

function store(projectExtensions: ExtensionDescriptor[]): AgentStore {
	return {
		messages: [],
		projectExtensions,
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
	it('renders Unity capabilities inside the Unity extension panel', async () => {
		const fallback = render(WorkspaceInspector, {
			store: store([]),
			view,
			hidden: false,
		});
		expect(
			fallback.container.querySelector(
				'[data-ui="unity-view-switch"] button:nth-child(2)',
			),
		).toBeNull();

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
				extras.container.querySelector(
					'[data-ui="unity-view-switch"] button:nth-child(2)',
				),
			).toBeTruthy(),
		);
		expect(
			extras.container.querySelector(
				'[data-ui="tabs-trigger"][data-value="extensions"]',
			),
		).toBeNull();
		fallback.unmount();
		extras.unmount();
	});
});
