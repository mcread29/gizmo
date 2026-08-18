/** Distance from the end, in pixels, still treated as "at the bottom". */
export const bottomTolerance = 24;

export interface ScrollMetrics {
	scrollHeight: number;
	scrollTop: number;
	clientHeight: number;
}

/**
 * Whether the newest content is in view.
 *
 * The scroll container must be able to actually reach the value this compares
 * against, which is why the transcript ends in a spacer element rather than
 * bottom padding: padding on the list is counted in scrollHeight but sits
 * outside the range the viewport will scroll to, leaving a permanent gap that
 * no threshold can close.
 */
export function isAtBottom(
	element: ScrollMetrics,
	tolerance = bottomTolerance,
): boolean {
	return (
		element.scrollHeight - element.scrollTop - element.clientHeight <= tolerance
	);
}
