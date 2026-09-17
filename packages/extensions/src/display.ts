import {
	parseCatalogDisplaySpec,
	readDisplayResult,
	type CatalogDisplaySpec,
	type DisplayResult,
	type DisplaySpec,
} from '@gizmo/protocol';

type DisplayOptions = {
	title?: string;
	catalog?: string;
	validateNode?: (node: CatalogDisplaySpec['elements'][string]) => boolean;
};

/**
 * Builds the `details` a tool returns so Gizmo renders `spec` as a chat
 * card. Without `catalog` the spec must use Gizmo's built-in catalog; with
 * one (`"<extensionId>/<name>"`) it is rendered by the component registry the
 * extension's web bundle registers under `displayCatalogs`. Gizmo validates
 * the tree and size on the client; the extension owns its prop shapes.
 */
export function gizmoDisplay(
	spec: DisplaySpec,
	options?: { title?: string },
): DisplayResult;
export function gizmoDisplay(
	spec: CatalogDisplaySpec,
	options: DisplayOptions & { catalog: string },
): DisplayResult;
export function gizmoDisplay(
	spec: DisplaySpec | CatalogDisplaySpec,
	options: DisplayOptions = {},
): DisplayResult {
	const title = options.title !== undefined ? { title: options.title } : {};
	let result: DisplayResult;
	if (options.catalog !== undefined) {
		if (!parseCatalogDisplaySpec(spec, options.validateNode))
			throw new Error('Invalid display catalog spec');
		result = {
			gizmoDisplay: {
				version: 1,
				...title,
				catalog: options.catalog,
				spec: spec as CatalogDisplaySpec,
			},
		};
	} else
		result = {
			gizmoDisplay: { version: 1, ...title, spec: spec as DisplaySpec },
		};
	const validated = readDisplayResult(result);
	if (!validated) throw new Error('Invalid display envelope');
	return { gizmoDisplay: validated };
}
