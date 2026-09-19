import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { AgentIdentity } from '@gizmo/protocol';
import type { AgentStore } from '../../../../src/lib/agent-client';
import { extensionUi } from '../../../../src/lib/extensions/extension-ui.svelte.ts';
import { extensionUiFixture } from '../../extensions/fixtures/ui.ts';
import { WorkspaceLayout } from '../../../../src/lib/features/shell/workspace.svelte.ts';
import TitlebarTestHost from './fixtures/TitlebarTestHost.svelte';

const agent: AgentIdentity = { name: 'Gizmo' } as AgentIdentity;

function store(): AgentStore {
	return {
		messages: [],
		sessionState: 'idle',
		selectedProjectPath: '/projects/game',
		enabledExtensionIds: ['fake'],
	} as unknown as AgentStore;
}

describe('Titlebar', () => {
	it("renders an extension's contributed status bar item", () => {
		// `git.branch` is the app's own status item; an extension claiming it
		// must not draw a second one.
		extensionUi.extensions = [
			extensionUiFixture('fake', {
				statusItems: [
					{ id: 'fake.status', label: 'main (2)', tone: 'accent' },
					{ id: 'git.branch', label: 'pi-web' },
				],
			}),
		];
		const result = render(TitlebarTestHost, {
			agent,
			layout: new WorkspaceLayout(),
			store: store(),
			onOpenSettings: () => {},
			onCloseSettings: () => {},
		});
		expect(result.queryByText('pi-web')).not.toBeInTheDocument();
		expect(result.getByText('game')).toBeInTheDocument();
		expect(result.getByText('1 extension')).toBeInTheDocument();
		const item = result.container.querySelector('[data-ui="status-bar-item"]');
		expect(item?.textContent?.trim()).toBe('main (2)');
		expect(item?.getAttribute('data-tone')).toBe('accent');
	});
});
