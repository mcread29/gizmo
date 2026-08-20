export const appRoutes = [
	'workspace',
	'settings',
	'workspace-settings',
	'tree',
] as const;

export type AppRoute = (typeof appRoutes)[number];

/** Settings is a set of pages rather than one scroll, so each is addressable. */
export const settingsPages = [
	'appearance',
	'chat',
	'context',
	'connection',
	'agent',
	'about',
] as const;

export type SettingsPage = (typeof settingsPages)[number];

export const defaultSettingsPage: SettingsPage = 'appearance';

interface Location {
	route: AppRoute;
	page: SettingsPage;
}

/** Unknown or empty fragments fall back to the workspace. */
export function routeFromHash(hash: string): AppRoute {
	return locationFromHash(hash).route;
}

export function locationFromHash(hash: string): Location {
	const [name, sub] = hash.replace(/^#\/?/, '').split('/');
	const route = appRoutes.includes(name as AppRoute)
		? (name as AppRoute)
		: 'workspace';
	return {
		route,
		page:
			route === 'settings'
				? (settingsPage(sub) ?? defaultSettingsPage)
				: defaultSettingsPage,
	};
}

/** Skills and Resources merged into Agent; their links still land there. */
function settingsPage(name: string | undefined): SettingsPage | undefined {
	if (name === 'resources' || name === 'skills') return 'agent';
	return settingsPages.includes(name as SettingsPage)
		? (name as SettingsPage)
		: undefined;
}

export function hashForRoute(route: AppRoute, page?: SettingsPage): string {
	if (route === 'workspace') return '#';
	return route === 'settings' && page && page !== defaultSettingsPage
		? `#settings/${page}`
		: `#${route}`;
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
	/** Which Settings page is showing. Meaningless on other routes. */
	settingsPage = $state<SettingsPage>(defaultSettingsPage);
	#pushed = false;

	constructor(hash = typeof location === 'undefined' ? '' : location.hash) {
		const initial = locationFromHash(hash);
		this.current = initial.route;
		this.settingsPage = initial.page;
	}

	/** Binds to history events. Returns the matching unbind. */
	start(): () => void {
		const onPopState = () => {
			const next = locationFromHash(location.hash);
			this.current = next.route;
			this.settingsPage = next.page;
			this.#pushed = this.current !== 'workspace' && this.#pushed;
		};
		addEventListener('popstate', onPopState);
		return () => removeEventListener('popstate', onPopState);
	}

	go(route: AppRoute, page?: SettingsPage): void {
		const nextPage = page ?? this.settingsPage;
		if (
			route === this.current &&
			(route !== 'settings' || nextPage === this.settingsPage)
		)
			return;
		history.pushState(null, '', hashForRoute(route, nextPage));
		this.#pushed = route !== 'workspace';
		this.current = route;
		if (route === 'settings') this.settingsPage = nextPage;
	}

	/** Moves between Settings pages without stacking a history entry each time. */
	showSettingsPage(page: SettingsPage): void {
		if (this.current !== 'settings') {
			this.go('settings', page);
			return;
		}
		if (page === this.settingsPage) return;
		this.settingsPage = page;
		history.replaceState(null, '', hashForRoute('settings', page));
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
