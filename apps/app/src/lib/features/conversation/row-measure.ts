/**
 * Keeps the virtualizer's measurement of a row current as the row's content
 * changes: a streaming reply, an expanding tool card, a code block that
 * highlights a frame after it mounts.
 *
 * Re-measuring inside the ResizeObserver callback moves the rows below, which
 * the observer sees in the same frame and reports as an undelivered loop.
 * Deferring one frame keeps the layout change out of the observer's own
 * delivery, and skipping unchanged heights keeps it quiet.
 */
export function createRowMeasurer<T extends HTMLElement>(
	measureElement: (node: T) => void,
	onMeasured: () => void,
) {
	return (node: T) => {
		measureElement(node);
		if (typeof ResizeObserver === 'undefined') return;
		let height = node.offsetHeight;
		let frame: number | undefined;
		const observer = new ResizeObserver(() => {
			if (node.offsetHeight === height || frame !== undefined) return;
			frame = requestAnimationFrame(() => {
				frame = undefined;
				height = node.offsetHeight;
				measureElement(node);
				onMeasured();
			});
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			if (frame !== undefined) cancelAnimationFrame(frame);
		};
	};
}
