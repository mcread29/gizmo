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
		expect(routeFromHash('#nonsense')).toBe('thread');
		expect(routeFromHash('')).toBe('thread');
	});

	it('round-trips through hashForRoute', () => {
		expect(routeFromHash(hashForRoute('settings'))).toBe('settings');
		expect(routeFromHash(hashForRoute('thread'))).toBe('thread');
	});

	it('reads the settings page from the fragment', () => {
		expect(locationFromHash('#settings/agent')).toEqual({
			route: 'settings',
			page: 'agent',
			tab: 'overview',
		});
		// An unknown page still opens Settings rather than dropping the route.
		expect(locationFromHash('#settings/nonsense')).toEqual({
			route: 'settings',
			page: 'appearance',
			tab: 'overview',
		});
		expect(
			locationFromHash(hashForRoute('settings', { page: 'chat' })),
		).toEqual({ route: 'settings', page: 'chat', tab: 'overview' });
		// Agent absorbed the old Skills and Resources pages.
		expect(locationFromHash('#settings/resources')).toMatchObject({
			route: 'settings',
			page: 'agent',
		});
		expect(locationFromHash('#settings/skills')).toMatchObject({
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
					expect(router.current).toBe('thread');
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
		expect(router.current).toBe('thread');
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

	it('carries the workspace and tab through the fragment', () => {
		const hash = hashForRoute('workspace', {
			workspacePath: '/home/dev/my repo',
			tab: 'configure',
		});

		expect(hash).toBe('#workspace/%2Fhome%2Fdev%2Fmy%20repo/configure');
		expect(locationFromHash(hash)).toMatchObject({
			route: 'workspace',
			workspacePath: '/home/dev/my repo',
			tab: 'configure',
		});
		// The overview is the default tab, so it stays out of the fragment.
		expect(hashForRoute('workspace', { workspacePath: '/home/dev/repo' })).toBe(
			'#workspace/%2Fhome%2Fdev%2Frepo',
		);
	});
});
