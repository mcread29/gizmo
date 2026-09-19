import {
	readDisplayResult,
	type DisplayResult,
	type DisplaySpec,
} from './display-schema';
import type { View } from './view';

/**
 * Builds the `details` a tool returns so Gizmo renders `spec` as a chat
 * card using its built-in json-render catalog (the same one the `display`
 * tool uses). Gizmo validates the tree and size again where it renders.
 */
export function gizmoDisplay(
	spec: DisplaySpec,
	options: { title?: string } = {},
): DisplayResult {
	const title = options.title !== undefined ? { title: options.title } : {};
	const validated = readDisplayResult({
		gizmoDisplay: { version: 1, ...title, spec },
	});
	if (!validated) throw new Error('Invalid display spec');
	return { gizmoDisplay: validated };
}

/**
 * Builds the `details` a tool returns so Gizmo renders `view` as a chat
 * card with the host's view renderer: the same blocks an extension panel
 * uses. This is how an extension gives a tool a native result card without
 * shipping a component.
 */
export function gizmoView(view: View): DisplayResult {
	const validated = readDisplayResult({
		gizmoDisplay: { version: 1, view },
	});
	if (!validated) throw new Error('Invalid view');
	return { gizmoDisplay: validated };
}
