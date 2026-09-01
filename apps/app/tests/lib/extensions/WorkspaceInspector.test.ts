import type { ExtensionDescriptor } from '@gizmo/protocol';
import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { AgentStore } from '../../../src/lib/agent-client';
import TestExtensionPanel from './fixtures/TestExtensionPanel.svelte';
import WorkspaceInspector from '../../../src/lib/extensions/WorkspaceInspector.svelte';
import { registerWebExtensions } from '../../../src/lib/extensions/registry.svelte.ts';

function store(projectExtensions: ExtensionDescriptor[]): AgentStore {
	return {
		messages: [],
		projectExtensions,
		enabledExtensionIds: projectExtensions.map(({ id }) => id),
		selectedProjectPath: '/projects/game',
		projectOpening: {},
		invokeProjectExtension: async () => ({}),
	} as unknown as AgentStore;
}

describe('WorkspaceInspector', () => {
	it('shows static tabs only for enabled extensions', async () => {
		registerWebExtensions([
			{
				id: 'git',
				inspectorTabs: () => [tab('git.panel', 'Changes')],
			},
			{
				id: 'activity',
				inspectorTabs: () => [tab('activity.panel', 'Activity')],
			},
		]);
		const inspector = render(WorkspaceInspector, {
			store: store([descriptor('git', 'Git')]),
			hidden: false,
		});

		expect(
			await inspector.findByRole('tab', { name: 'Changes' }),
		).toBeInTheDocument();
		expect(
			inspector.queryByRole('tab', { name: 'Activity' }),
		).not.toBeInTheDocument();
		inspector.unmount();
	});

	it('renders every project runtime as a peer inspector tab', async () => {
		const disposeSubagents = vi.fn();
		const disposeWorkflows = vi.fn();
		registerWebExtensions([
			runtimeExtension(
				'subagents',
				'subagents.panel',
				'Subagents',
				disposeSubagents,
			),
			runtimeExtension(
				'workflows',
				'workflows.panel',
				'Workflows',
				disposeWorkflows,
			),
		]);
		const inspector = render(WorkspaceInspector, {
			store: store([
				descriptor('subagents', 'Subagents'),
				descriptor('workflows', 'Workflows'),
			]),
			hidden: false,
		});

		expect(
			await inspector.findByRole('tab', { name: 'Subagents' }),
		).toBeInTheDocument();
		expect(
			await inspector.findByRole('tab', { name: 'Workflows' }),
		).toBeInTheDocument();
		inspector.unmount();
		expect(disposeSubagents).toHaveBeenCalledOnce();
		expect(disposeWorkflows).toHaveBeenCalledOnce();
	});

	it('owns the empty inspector state when no enabled extension contributes UI', () => {
		registerWebExtensions([]);
		const inspector = render(WorkspaceInspector, {
			store: store([]),
			hidden: false,
		});

		expect(
			inspector.getByText('No inspector extensions enabled'),
		).toBeInTheDocument();
		inspector.unmount();
	});
});

function runtimeExtension(
	id: string,
	tabId: string,
	label: string,
	dispose = () => {},
) {
	return {
		id,
		apiVersion: 1,
		activate: () => ({
			inspectorTabs: [tab(tabId, label)],
			dispose,
		}),
	};
}

function tab(id: string, label: string) {
	return {
		id,
		label,
		component: TestExtensionPanel,
		props: {},
	};
}

function descriptor(id: string, name: string): ExtensionDescriptor {
	return {
		id,
		name,
		version: '0.1.0',
		apiVersion: 1,
		capabilities: [],
		operations: [],
	};
}
