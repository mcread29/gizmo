export const appRoutes = ['workspace', 'settings', 'tree'] as const;

export type AppRoute = (typeof appRoutes)[number];

/** Unknown or empty fragments fall back to the workspace. */
export function routeFromHash(hash: string): AppRoute {
	const name = hash.replace(/^#\/?/, '');
	return appRoutes.includes(name as AppRoute)
		? (name as AppRoute)
		: 'workspace';
}

export function hashForRoute(route: AppRoute): string {
	return route === 'workspace' ? '#' : `#${route}`;
}

/**
 * Full-screen views live in browser history so Back — including the mouse's
 * back button, which the app never sees as a key event — leaves them. Only
 * views the app itself pushed are popped; a window opened directly on
 * `#settings` closes by rewriting the entry rather than navigating away from
 * the app entirely.
 */
export class AppRouter {
	current = $state<AppRoute>('workspace');
	#pushed = false;

	constructor(hash = typeof location === 'undefined' ? '' : location.hash) {
		this.current = routeFromHash(hash);
	}

	/** Binds to history events. Returns the matching unbind. */
	start(): () => void {
		const onPopState = () => {
			this.current = routeFromHash(location.hash);
			this.#pushed = this.current !== 'workspace' && this.#pushed;
		};
		addEventListener('popstate', onPopState);
		return () => removeEventListener('popstate', onPopState);
	}

	go(route: AppRoute): void {
		if (route === this.current) return;
		history.pushState(null, '', hashForRoute(route));
		this.#pushed = route !== 'workspace';
		this.current = route;
	}

	close(): void {
		if (this.current === 'workspace') return;
		if (this.#pushed) {
			history.back();
			return;
		}
		history.replaceState(null, '', hashForRoute('workspace'));
		this.current = 'workspace';
	}
}
