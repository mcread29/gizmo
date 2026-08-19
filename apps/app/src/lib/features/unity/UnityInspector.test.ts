import type { UnityExtensionDescriptor } from '@unity-agent/protocol';
import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { AgentStore } from '../../agent-client';
import UnityInspector from './UnityInspector.svelte';
import type { UnityView } from './unity-view';

const view: UnityView = {
	projectPath: '/projects/game',
	projectName: 'game',
	state: 'connected',
	lifecycle: { state: 'ready', label: 'Ready', errors: [], pendingPaths: [] },
	consoleDiagnostics: [],
	toolActivity: [],
};

function store(projectExtensions: UnityExtensionDescriptor[]): AgentStore {
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

describe('UnityInspector', () => {
	it('only renders contributions from installed extensions', async () => {
		const fallback = render(UnityInspector, {
			store: store([]),
			view,
			hidden: false,
			onOpenProject: () => {},
		});
		expect(
			fallback.container.querySelector(
				'[data-value="com.gizmo.extras.console.console"]',
			),
		).toBeNull();

		const extras = render(UnityInspector, {
			store: store([
				{
					id: 'com.gizmo.extras.console',
					name: 'Console',
					version: '0.1.0',
					apiVersion: 1,
					capabilities: ['unity.console'],
					operations: [
						{
							id: 'snapshot',
							mutates: false,
							requiresConfirmation: false,
						},
					],
				},
			]),
			view,
			hidden: false,
			onOpenProject: () => {},
		});
		await waitFor(() =>
			expect(
				extras.container.querySelector(
					'[data-value="com.gizmo.extras.console.console"]',
				),
			).toBeTruthy(),
		);
		fallback.unmount();
		extras.unmount();
	});
});
