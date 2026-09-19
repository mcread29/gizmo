import type { ExtensionUi } from '@gizmo/extension-api';

/** An extension contributing nothing, to be spread over with what a test needs. */
export function extensionUiFixture(
	id: string,
	overrides: Partial<ExtensionUi> = {},
): ExtensionUi {
	return {
		id,
		name: id,
		views: [],
		statusItems: [],
		commands: [],
		settings: [],
		toolPresentation: {},
		hasProjectService: false,
		...overrides,
	};
}
