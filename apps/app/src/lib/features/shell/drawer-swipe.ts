/**
 * Edge swipes for the overlay drawers: a finger dragged in from the left
 * edge opens the thread sidebar, from the right edge the inspector, and a
 * drag back towards the edge closes whichever is open. Mouse pointers are
 * ignored; they have the titlebar buttons.
 */
export interface SwipeTarget {
	readonly leftMode: 'docked' | 'overlay';
	readonly rightMode: 'docked' | 'overlay';
	readonly leftDrawerOpen: boolean;
	readonly rightDrawerOpen: boolean;
	toggleLeft(): void;
	toggleRight(): void;
	closeDrawers(): void;
}

/** How far in from the edge a swipe may start when no drawer is open. */
export const edgeWidth = 28;
/** The horizontal travel that commits a swipe. */
export const swipeDistance = 48;

export function watchDrawerSwipes(
	element: HTMLElement,
	target: SwipeTarget,
): () => void {
	let start: { x: number; y: number; id: number } | undefined;

	const down = (event: PointerEvent) => {
		if (event.pointerType !== 'touch' || !event.isPrimary) return;
		const width = element.clientWidth;
		const drawerOpen =
			(target.leftMode === 'overlay' && target.leftDrawerOpen) ||
			(target.rightMode === 'overlay' && target.rightDrawerOpen);
		if (!drawerOpen && !nearEdge(event.clientX, width)) return;
		start = { x: event.clientX, y: event.clientY, id: event.pointerId };
	};

	const move = (event: PointerEvent) => {
		if (!start || event.pointerId !== start.id) return;
		const action = swipeAction(
			event.clientX - start.x,
			event.clientY - start.y,
			start.x,
			element.clientWidth,
			target,
		);
		if (!action) return;
		start = undefined;
		if (action === 'close') target.closeDrawers();
		else if (action === 'open-left') target.toggleLeft();
		else if (action === 'open-right') target.toggleRight();
	};

	const end = () => {
		start = undefined;
	};

	element.addEventListener('pointerdown', down);
	element.addEventListener('pointermove', move);
	element.addEventListener('pointerup', end);
	element.addEventListener('pointercancel', end);
	return () => {
		element.removeEventListener('pointerdown', down);
		element.removeEventListener('pointermove', move);
		element.removeEventListener('pointerup', end);
		element.removeEventListener('pointercancel', end);
	};
}

function nearEdge(x: number, width: number): boolean {
	return x <= edgeWidth || x >= width - edgeWidth;
}

/**
 * What a drag of (dx, dy) from startX means, or `abandon` once it is clearly
 * a vertical scroll, or undefined while it is still too short to tell.
 */
export function swipeAction(
	dx: number,
	dy: number,
	startX: number,
	width: number,
	target: Pick<
		SwipeTarget,
		'leftMode' | 'rightMode' | 'leftDrawerOpen' | 'rightDrawerOpen'
	>,
): 'open-left' | 'open-right' | 'close' | 'abandon' | undefined {
	if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) return 'abandon';
	if (Math.abs(dx) < swipeDistance) return undefined;
	const leftOpen = target.leftMode === 'overlay' && target.leftDrawerOpen;
	const rightOpen = target.rightMode === 'overlay' && target.rightDrawerOpen;
	if (leftOpen) return dx < 0 ? 'close' : 'abandon';
	if (rightOpen) return dx > 0 ? 'close' : 'abandon';
	if (dx > 0 && startX <= edgeWidth && target.leftMode === 'overlay')
		return 'open-left';
	if (dx < 0 && startX >= width - edgeWidth && target.rightMode === 'overlay')
		return 'open-right';
	return 'abandon';
}
