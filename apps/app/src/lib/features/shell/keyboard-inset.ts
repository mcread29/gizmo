/**
 * Publishes the on-screen keyboard's height as `--keyboard-inset` on the root
 * element. Browsers that honour `interactive-widget=resizes-content` shrink
 * the layout viewport themselves and report no inset; iOS Safari does not, and
 * instead only shrinks the visual viewport, which is what this reads.
 *
 * The keyboard is measured against the shell's own height rather than the
 * window's: an installed iOS app lays the shell out taller than the window
 * it reports (see the standalone rule in shell-parts/layout.css).
 */
export function watchKeyboardInset(
	viewport: VisualViewport | null = typeof window === 'undefined'
		? null
		: window.visualViewport,
	root: HTMLElement | undefined = typeof document === 'undefined'
		? undefined
		: document.documentElement,
	layoutHeight: () => number = () =>
		document.querySelector<HTMLElement>('[data-ui="app-shell"]')
			?.offsetHeight ?? window.innerHeight,
): () => void {
	if (!viewport || !root) return () => {};
	const update = () => {
		root.style.setProperty(
			'--keyboard-inset',
			`${keyboardInset(viewport, layoutHeight())}px`,
		);
	};
	update();
	viewport.addEventListener('resize', update);
	viewport.addEventListener('scroll', update);
	return () => {
		viewport.removeEventListener('resize', update);
		viewport.removeEventListener('scroll', update);
		root.style.removeProperty('--keyboard-inset');
	};
}

/**
 * The part of the layout viewport the visual viewport no longer reaches.
 * Anything under 100px is browser chrome settling, not a keyboard.
 */
export function keyboardInset(
	viewport: Pick<VisualViewport, 'height' | 'offsetTop'>,
	layoutHeight: number,
): number {
	const inset = layoutHeight - viewport.height - viewport.offsetTop;
	return inset > 100 ? Math.round(inset) : 0;
}
