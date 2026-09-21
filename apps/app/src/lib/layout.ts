/**
 * The only place layout breakpoints are defined. The shell reads them here and
 * publishes the result as `data-left-mode` / `data-right-mode` on the shell
 * element; stylesheets key off those attributes and never restate a width. Two
 * declarations of the same number in two languages is how the two drift.
 */
export const layoutBreakpoints = {
	/** Below this the thread sidebar becomes an overlay drawer. */
	sidebar: 720,
	/** Below this the workspace inspector becomes an overlay drawer. */
	inspector: 1040,
	/**
	 * At or below this the window is a phone: dialogs become bottom sheets and
	 * the settings nav becomes a page of its own. Published as `data-phone`.
	 */
	phone: 480,
} as const;

export type PanelMode = 'docked' | 'overlay';

/**
 * The media query that means "a finger, not a mouse". Published on the root
 * element as `data-touch` so stylesheets and scripts agree on one definition;
 * styles never restate the query.
 */
export const touchMediaQuery = '(hover: none) and (pointer: coarse)';

export function currentViewportWidth(): number {
	return typeof window === 'undefined'
		? layoutBreakpoints.inspector + 1
		: window.innerWidth;
}

export function currentTouch(): boolean {
	return (
		typeof matchMedia === 'function' && matchMedia(touchMediaQuery).matches
	);
}

/**
 * Calls back when the pointer query flips, which plugging in a mouse or a
 * keyboard does without a resize. Returns the unsubscribe.
 */
export function watchTouch(onChange: () => void): () => void {
	if (typeof matchMedia !== 'function') return () => {};
	const query = matchMedia(touchMediaQuery);
	query.addEventListener('change', onChange);
	return () => query.removeEventListener('change', onChange);
}

export function sidebarMode(width: number): PanelMode {
	return width <= layoutBreakpoints.sidebar ? 'overlay' : 'docked';
}

export function inspectorMode(width: number): PanelMode {
	return width <= layoutBreakpoints.inspector ? 'overlay' : 'docked';
}

export function isPhone(width: number): boolean {
	return width <= layoutBreakpoints.phone;
}
