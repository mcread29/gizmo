import { ProjectCatalog } from '../projects/project-catalog';
import { enabledPiExtensionPaths } from '../resources/pi-global-resources';

/** Pi retains this array, so replace its contents before resource reload. */
export async function refreshExtensionPaths(
	paths: string[],
	builtins: readonly string[],
	workspacePath: string,
) {
	const overrides = await new ProjectCatalog().piExtensionOverridesFor(
		workspacePath,
	);
	const paths_ = await enabledPiExtensionPaths(
		new Set(overrides.disabled),
		new Set(overrides.enabled),
	);
	paths.splice(0, paths.length, ...builtins, ...paths_);
}
