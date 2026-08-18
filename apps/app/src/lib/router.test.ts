import { describe, expect, it } from 'vitest';
import { AppRouter, hashForRoute, routeFromHash } from './router.svelte';

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
});
