import { describe, expect, it } from 'vitest';
import {
	AppRouter,
	hashForRoute,
	locationFromHash,
	routeFromHash,
} from './router.svelte';

describe('routeFromHash', () => {
	it('reads a known view and ignores anything else', () => {
		expect(routeFromHash('#settings')).toBe('settings');
		expect(routeFromHash('#/settings')).toBe('settings');
		expect(routeFromHash('#nonsense')).toBe('workspace');
		expect(routeFromHash('')).toBe('workspace');
	});

	it('round-trips through hashForRoute', () => {
		expect(routeFromHash(hashForRoute('settings'))).toBe('settings');
		expect(routeFromHash(hashForRoute('workspace'))).toBe('workspace');
		expect(routeFromHash(hashForRoute('workspace-settings'))).toBe(
			'workspace-settings',
		);
	});

	it('reads the settings page from the fragment', () => {
		expect(locationFromHash('#settings/agent')).toEqual({
			route: 'settings',
			page: 'agent',
		});
		// An unknown page still opens Settings rather than dropping the route.
		expect(locationFromHash('#settings/nonsense')).toEqual({
			route: 'settings',
			page: 'appearance',
		});
		expect(locationFromHash(hashForRoute('settings', 'chat'))).toEqual({
			route: 'settings',
			page: 'chat',
		});
		// Agent absorbed the old Skills and Resources pages.
		expect(locationFromHash('#settings/resources')).toEqual({
			route: 'settings',
			page: 'agent',
		});
		expect(locationFromHash('#settings/skills')).toEqual({
			route: 'settings',
			page: 'agent',
		});
	});
});

describe('AppRouter', () => {
	it('pushes a history entry so Back leaves the view', () => {
		const router = new AppRouter('');
		const stop = router.start();
		router.go('settings');
		expect(location.hash).toBe('#settings');

		history.back();
		return new Promise<void>((resolve) => {
			addEventListener(
				'popstate',
				() => {
					expect(router.current).toBe('workspace');
					stop();
					resolve();
				},
				{ once: true },
			);
		});
	});

	it('rewrites rather than navigating when it did not push the view', () => {
		history.replaceState(null, '', '#settings');
		const router = new AppRouter('#settings');
		expect(router.current).toBe('settings');
		router.close();
		expect(router.current).toBe('workspace');
		expect(location.hash).not.toBe('#settings');
	});

	it('swaps settings pages without stacking history entries', () => {
		history.replaceState(null, '', '#');
		const router = new AppRouter('');
		const stop = router.start();
		router.go('settings');
		const depth = history.length;

		router.showSettingsPage('agent');
		expect(router.settingsPage).toBe('agent');
		expect(location.hash).toBe('#settings/agent');
		expect(history.length).toBe(depth);
		stop();
	});
});
