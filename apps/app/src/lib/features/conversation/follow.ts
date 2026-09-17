/** Distance from the end, in pixels, still treated as "at the bottom". */
export const bottomTolerance = 24;

export interface ScrollMetrics {
	scrollHeight: number;
	scrollTop: number;
	clientHeight: number;
}

/** Whether the newest content is in view. */
export function isAtBottom(
	element: ScrollMetrics,
	tolerance = bottomTolerance,
): boolean {
	return (
		element.scrollHeight - element.scrollTop - element.clientHeight <= tolerance
	);
}

/**
 * Guarded scroll: jsdom has no scrollIntoView, and neither does an element that
 * has not been mounted yet, so callers should not each repeat this check.
 */
export function scrollIntoEnd(
	element: Element | null | undefined,
	behavior: ScrollBehavior = 'auto',
	block: ScrollLogicalPosition = 'end',
): void {
	if (typeof element?.scrollIntoView !== 'function') return;
	element.scrollIntoView({ block, behavior });
}

const scrollKeys = new Set([
	'ArrowUp',
	'ArrowDown',
	'PageUp',
	'PageDown',
	'Home',
	'End',
	' ',
]);

/** How long after a wheel tick or key press a scroll still counts as the user's. */
const intentWindowMs = 400;
/** Touch momentum keeps scrolling well after the finger has lifted. */
const momentumWindowMs = 1500;
/** A pointer that moves this far while held is a drag, not a click. */
const dragThreshold = 4;

/**
 * Decides who moved the transcript. Following used to be released on every
 * scroll event that did not land at the bottom, but most of those are not the
 * user: the virtualizer re-pinning the end as a reply grows, a smooth jump on
 * its way down, a row re-measuring after a code block renders. Each of those
 * dropped the thread mid-stream. Only a wheel tick, a key, a touch, or a drag
 * (of the scrollbar, or of a selection) is treated as the user reaching in.
 */
export function observeFollow(
	node: HTMLElement,
	onScroll: (atBottom: boolean, byUser: boolean) => void,
): () => void {
	let intentUntil = 0;
	let pointerStart: number | undefined;
	let dragging = false;
	const now = () => performance.now();
	const note = (window = intentWindowMs) => {
		intentUntil = now() + window;
	};
	const onWheel = () => note();
	const onKeyDown = (event: KeyboardEvent) => {
		if (scrollKeys.has(event.key)) note();
	};
	const onTouchStart = () => {
		dragging = true;
	};
	const onTouchEnd = () => {
		dragging = false;
		note(momentumWindowMs);
	};
	const onPointerDown = (event: PointerEvent) => {
		if (event.pointerType === 'touch') return;
		pointerStart = event.clientY;
	};
	const onPointerMove = (event: PointerEvent) => {
		if (pointerStart === undefined || dragging) return;
		if (Math.abs(event.clientY - pointerStart) >= dragThreshold)
			dragging = true;
	};
	const onPointerUp = () => {
		if (dragging) note();
		pointerStart = undefined;
		dragging = false;
	};
	const onScrollEvent = () => {
		onScroll(isAtBottom(node), dragging || now() < intentUntil);
	};
	const passive = { passive: true } as const;
	node.addEventListener('scroll', onScrollEvent, passive);
	node.addEventListener('wheel', onWheel, passive);
	node.addEventListener('keydown', onKeyDown);
	node.addEventListener('touchstart', onTouchStart, passive);
	node.addEventListener('touchend', onTouchEnd, passive);
	node.addEventListener('touchcancel', onTouchEnd, passive);
	window.addEventListener('pointerdown', onPointerDown, passive);
	window.addEventListener('pointermove', onPointerMove, passive);
	window.addEventListener('pointerup', onPointerUp, passive);
	window.addEventListener('pointercancel', onPointerUp, passive);
	return () => {
		node.removeEventListener('scroll', onScrollEvent);
		node.removeEventListener('wheel', onWheel);
		node.removeEventListener('keydown', onKeyDown);
		node.removeEventListener('touchstart', onTouchStart);
		node.removeEventListener('touchend', onTouchEnd);
		node.removeEventListener('touchcancel', onTouchEnd);
		window.removeEventListener('pointerdown', onPointerDown);
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerUp);
	};
}
