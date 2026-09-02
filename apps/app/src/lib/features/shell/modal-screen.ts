/**
 * Settings and the session tree are full-screen overlays: fixed above the
 * workspace, opened from a shortcut and dismissed with Escape. They behave like
 * modals, so they owe a modal's keyboard contract.
 *
 * Containment is handled by marking the covered shell content `inert`, not by
 * trapping Tab inside the panel — the titlebar stays above the overlay and
 * carries its only visible way out, so a trap would lock the user away from the
 * button they can see. What is left is the part `inert` cannot do: moving focus
 * into the panel when it opens, and putting it back where it came from when it
 * closes.
 */
export function focusOnOpen(node: HTMLElement) {
	const restoreTo = document.activeElement;
	// The panel itself, not its first control: screen readers should announce
	// the screen by its own label before describing anything inside it.
	node.focus?.({ preventScroll: true });
	return () => {
		if (restoreTo instanceof HTMLElement && restoreTo.isConnected) {
			restoreTo.focus({ preventScroll: true });
		}
	};
}
