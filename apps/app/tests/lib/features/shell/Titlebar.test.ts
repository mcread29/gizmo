import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { AgentIdentity } from '@gizmo/protocol';
import type { AgentStore } from '../../../../src/lib/agent-client';
import type { GizmoWebExtension } from '../../../../src/lib/extensions/types';
import type { WorkspaceView } from '../../../../src/lib/extensions/types';
import { WorkspaceLayout } from '../../../../src/lib/features/shell/workspace.svelte.ts';
import TitlebarTestHost from './fixtures/TitlebarTestHost.svelte';

const fakeExtension: GizmoWebExtension = {
	id: 'fake',
	statusBar: () => [{ id: 'fake.status', label: 'main (2)', tone: 'accent' }],
};

vi.mock('../../../../src/lib/extensions/registry.svelte', () => ({
	webExtensions: () => [fakeExtension],
}));

const agent: AgentIdentity = { name: 'Gizmo' } as AgentIdentity;

const view: WorkspaceView = {
	workspaceName: 'game',
	subtitle: 'Workspace',
	toolActivity: [],
	canOpen: false,
	open: () => {},
	refresh: () => {},
};

function store(): AgentStore {
	return {
		messages: [],
		sessionState: 'idle',
		selectedProjectPath: '/projects/game',
		activeDomains: ['fake'],
	} as unknown as AgentStore;
}

describe('Titlebar', () => {
	it("renders an extension's contributed status bar item", () => {
		const result = render(TitlebarTestHost, {
			agent,
			layout: new WorkspaceLayout(),
			view,
			store: store(),
			onOpenSettings: () => {},
			onCloseSettings: () => {},
		});
		const item = result.container.querySelector('[data-ui="status-bar-item"]');
		expect(item?.textContent?.trim()).toBe('main (2)');
		expect(item?.getAttribute('data-tone')).toBe('accent');
	});
});
