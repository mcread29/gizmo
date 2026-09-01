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
