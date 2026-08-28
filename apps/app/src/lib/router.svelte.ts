export const appRoutes = ['thread', 'workspace', 'settings', 'tree'] as const;

export type AppRoute = (typeof appRoutes)[number];

/** Settings is a set of pages rather than one scroll, so each is addressable. */
export const settingsPages = [
	'appearance',
	'chat',
	'context',
	'connection',
	'providers',
	'agent',
	'skills',
	'extensions',
	'about',
] as const;

export type SettingsPage = (typeof settingsPages)[number];

export const defaultSettingsPage: SettingsPage = 'appearance';

/** A workspace screen shows one workspace; its tabs are addressable too. */
export const workspaceTabs = ['overview', 'configure'] as const;

export type WorkspaceTab = (typeof workspaceTabs)[number];

export const defaultWorkspaceTab: WorkspaceTab = 'overview';

export interface AppLocation {
	route: AppRoute;
	page: SettingsPage;
	/** Which workspace the workspace route is showing. */
	workspacePath?: string;
	tab: WorkspaceTab;
}

/** Unknown or empty fragments fall back to the thread view. */
export function routeFromHash(hash: string): AppRoute {
	return locationFromHash(hash).route;
}

export function locationFromHash(hash: string): AppLocation {
	const [name, ...rest] = hash.replace(/^#\/?/, '').split('/');
	const route = appRoutes.includes(name as AppRoute)
		? (name as AppRoute)
		: 'thread';
	if (route === 'workspace') {
		const [encoded, tab] = rest;
		return {
			route,
			page: defaultSettingsPage,
			...(encoded ? { workspacePath: decode(encoded) } : {}),
			tab: workspaceTabs.includes(tab as WorkspaceTab)
				? (tab as WorkspaceTab)
				: defaultWorkspaceTab,
		};
	}
	return {
		route,
		page:
			route === 'settings'
				? (settingsPage(rest[0]) ?? defaultSettingsPage)
				: defaultSettingsPage,
		tab: defaultWorkspaceTab,
	};
}

/** Resources merged into Agent; old links still land there. */
function settingsPage(name: string | undefined): SettingsPage | undefined {
	if (name === 'resources') return 'agent';
	return settingsPages.includes(name as SettingsPage)
		? (name as SettingsPage)
		: undefined;
}

function decode(value: string): string | undefined {
	try {
		return decodeURIComponent(value) || undefined;
	} catch {
		return undefined;
	}
}

export interface RouteTarget {
	page?: SettingsPage;
	workspacePath?: string;
	tab?: WorkspaceTab;
}

export function hashForRoute(
	route: AppRoute,
	target: RouteTarget = {},
): string {
	if (route === 'thread') return '#';
	if (route === 'workspace') {
		if (!target.workspacePath) return '#workspace';
		const encoded = encodeURIComponent(target.workspacePath);
		return target.tab && target.tab !== defaultWorkspaceTab
			? `#workspace/${encoded}/${target.tab}`
			: `#workspace/${encoded}`;
	}
	return route === 'settings' &&
		target.page &&
		target.page !== defaultSettingsPage
		? `#settings/${target.page}`
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
	current = $state<AppRoute>('thread');
	/** Which Settings page is showing. Meaningless on other routes. */
	settingsPage = $state<SettingsPage>(defaultSettingsPage);
	/** Which workspace the workspace route is showing, and which of its tabs. */
	workspacePath = $state<string>();
	workspaceTab = $state<WorkspaceTab>(defaultWorkspaceTab);
	#pushed = false;

	constructor(hash = typeof location === 'undefined' ? '' : location.hash) {
		this.#apply(locationFromHash(hash));
	}

	/** Binds to history events. Returns the matching unbind. */
	start(): () => void {
		const onPopState = () => {
			this.#apply(locationFromHash(location.hash));
			this.#pushed = this.current !== 'thread' && this.#pushed;
		};
		addEventListener('popstate', onPopState);
		return () => removeEventListener('popstate', onPopState);
	}

	go(route: AppRoute, target: RouteTarget = {}): void {
		const next = {
			page: target.page ?? this.settingsPage,
			workspacePath: target.workspacePath ?? this.workspacePath,
			tab: target.tab ?? defaultWorkspaceTab,
		};
		if (this.#matches(route, next)) return;
		history.pushState(null, '', hashForRoute(route, next));
		this.#pushed = route !== 'thread';
		this.current = route;
		if (route === 'settings') this.settingsPage = next.page;
		if (route === 'workspace') {
			this.workspacePath = next.workspacePath;
			this.workspaceTab = next.tab;
		}
	}

	/** Moves between Settings pages without stacking a history entry each time. */
	showSettingsPage(page: SettingsPage): void {
		if (this.current !== 'settings') {
			this.go('settings', { page });
			return;
		}
		if (page === this.settingsPage) return;
		this.settingsPage = page;
		history.replaceState(null, '', hashForRoute('settings', { page }));
	}

	/** Workspace tabs behave the same way: a swap, not a new destination. */
	showWorkspaceTab(tab: WorkspaceTab): void {
		if (this.current !== 'workspace' || tab === this.workspaceTab) return;
		this.workspaceTab = tab;
		history.replaceState(
			null,
			'',
			hashForRoute('workspace', { workspacePath: this.workspacePath, tab }),
		);
	}

	close(): void {
		if (this.current === 'thread') return;
		if (this.#pushed) {
			history.back();
			return;
		}
		history.replaceState(null, '', hashForRoute('thread'));
		this.current = 'thread';
	}

	#matches(route: AppRoute, target: RouteTarget): boolean {
		if (route !== this.current) return false;
		if (route === 'settings') return target.page === this.settingsPage;
		if (route === 'workspace') {
			return (
				target.workspacePath === this.workspacePath &&
				target.tab === this.workspaceTab
			);
		}
		return true;
	}

	#apply(location: AppLocation): void {
		this.current = location.route;
		this.settingsPage = location.page;
		this.workspacePath = location.workspacePath;
		this.workspaceTab = location.tab;
	}
}
