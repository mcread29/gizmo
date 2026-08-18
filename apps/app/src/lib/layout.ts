/**
 * The only place layout breakpoints are defined. The shell reads them here and
 * publishes the result as `data-left-mode` / `data-right-mode` on the shell
 * element; stylesheets key off those attributes and never restate a width. Two
 * declarations of the same number in two languages is how the two drift.
 */
export const layoutBreakpoints = {
	/** Below this the thread sidebar becomes an overlay drawer. */
	sidebar: 720,
	/** Below this the Unity inspector becomes an overlay drawer. */
	inspector: 1040,
} as const;

export type PanelMode = 'docked' | 'overlay';

export function currentViewportWidth(): number {
	return typeof window === 'undefined'
		? layoutBreakpoints.inspector + 1
		: window.innerWidth;
}

export function sidebarMode(width: number): PanelMode {
	return width <= layoutBreakpoints.sidebar ? 'overlay' : 'docked';
}

export function inspectorMode(width: number): PanelMode {
	return width <= layoutBreakpoints.inspector ? 'overlay' : 'docked';
}
