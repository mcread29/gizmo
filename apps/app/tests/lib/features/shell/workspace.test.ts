import { describe, expect, it } from 'vitest';
import { defaultAppSettings } from '../../../../src/lib/app-settings';
import { WorkspaceLayout } from '../../../../src/lib/features/shell/workspace.svelte.ts';

function layout(width: number) {
	const workspace = new WorkspaceLayout({ ...defaultAppSettings });
	workspace.measure(width);
	return workspace;
}

describe('WorkspaceLayout', () => {
	it('undocks panels the window is too narrow to hold', () => {
		expect(layout(1440).rightMode).toBe('docked');
		expect(layout(1000).rightMode).toBe('overlay');
		expect(layout(1000).leftMode).toBe('docked');
		expect(layout(600).leftMode).toBe('overlay');
	});

	it('shrinks docked panels rather than squeezing the conversation', () => {
		const workspace = layout(1100);

		expect(
			workspace.sidebarWidth + workspace.inspectorWidth,
		).toBeLessThanOrEqual(1100 - 420);
	});

	it('toggles visibility for docked panels and drawers for undocked ones', () => {
		const docked = layout(1440);
		docked.toggleLeft();
		expect(docked.showThreadSidebar).toBe(false);
		expect(docked.leftVisible).toBe(false);

		const narrow = layout(600);
		narrow.toggleLeft();
		expect(narrow.showThreadSidebar).toBe(true);
		expect(narrow.leftVisible).toBe(true);
		expect(narrow.drawerOpen).toBe(true);
	});

	it('treats the phone breakpoint as a width, not a pointer', () => {
		expect(layout(390).phone).toBe(true);
		expect(layout(600).phone).toBe(false);
	});

	it('lets Enter insert a newline on a touch keyboard', () => {
		const desktop = new WorkspaceLayout({ ...defaultAppSettings });
		desktop.measure(1440, false);
		expect(desktop.enterSends).toBe(true);

		const phone = new WorkspaceLayout({ ...defaultAppSettings });
		phone.measure(390, true);
		expect(phone.touch).toBe(true);
		expect(phone.enterSends).toBe(false);

		phone.sendOnEnter = false;
		phone.measure(1440, false);
		expect(phone.enterSends).toBe(false);
	});

	it('keeps only one drawer open at a time', () => {
		const narrow = layout(600);
		narrow.toggleRight();
		narrow.toggleLeft();

		expect(narrow.leftDrawerOpen).toBe(true);
		expect(narrow.rightDrawerOpen).toBe(false);
	});

	it('restores workspace preferences without discarding the server address', () => {
		const workspace = layout(1440);
		workspace.theme = 'vesper-light';
		workspace.sidebarWidth = 400;
		workspace.agentUrl = 'ws://example.test/agent';

		workspace.restoreDefaults();

		expect(workspace.theme).toBe(defaultAppSettings.theme);
		expect(workspace.sidebarWidth).toBe(defaultAppSettings.sidebarWidth);
		expect(workspace.agentUrl).toBe('ws://example.test/agent');
	});
});
