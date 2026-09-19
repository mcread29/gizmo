import { ProjectCatalog } from '../projects/project-catalog';
import { enabledPiExtensionPaths } from '../resources/pi-global-resources';

/** Pi retains this array, so replace its contents before resource reload. */
export async function refreshExtensionPaths(
	paths: string[],
	builtins: readonly string[],
	workspacePath: string,
) {
	const projects = new ProjectCatalog();
	const overrides = await projects.piExtensionOverridesFor(workspacePath);
	const paths_ = await enabledPiExtensionPaths(
		new Set(overrides.disabled),
		new Set(overrides.enabled),
	);
	const projectPaths = await projects.projectExtensionPathsFor(workspacePath);
	paths.splice(0, paths.length, ...builtins, ...paths_, ...projectPaths);
}
