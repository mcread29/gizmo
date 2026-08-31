/** Grows a textarea with its content up to the CSS max-height, then scrolls. */
export function autoGrow(node: HTMLTextAreaElement) {
	const resize = () => resizeComposer(node);
	resize();
	node.addEventListener('input', resize);
	const observer =
		typeof ResizeObserver === 'undefined'
			? undefined
			: new ResizeObserver(resize);
	observer?.observe(node);
	return () => {
		node.removeEventListener('input', resize);
		observer?.disconnect();
	};
}

export function resizeComposer(node: HTMLTextAreaElement | undefined): void {
	if (!node) return;
	node.style.height = 'auto';
	const computedMax = Number.parseFloat(getComputedStyle(node).maxHeight);
	const maxHeight = Number.isFinite(computedMax) ? computedMax : 240;
	const height = Math.min(node.scrollHeight, maxHeight);
	node.style.height = `${height}px`;
	node.style.overflowY = node.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

/**
 * Enter sends, or Ctrl/Cmd+Enter does, depending on the user's preference.
 * Returns true when the event was consumed as a send.
 */
export function isSendKey(event: KeyboardEvent, sendOnEnter: boolean): boolean {
	if (event.key !== 'Enter') return false;
	return sendOnEnter ? !event.shiftKey : event.metaKey || event.ctrlKey;
}
