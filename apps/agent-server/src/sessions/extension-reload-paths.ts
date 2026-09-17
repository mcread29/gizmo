import { ProjectCatalog } from '../projects/project-catalog';
import { enabledPiExtensionPaths } from '../resources/pi-global-resources';

/** Pi retains this array, so replace its contents before resource reload. */
export async function refreshExtensionPaths(
	paths: string[],
	builtins: readonly string[],
	workspacePath: string,
) {
	const disabled = await new ProjectCatalog().disabledPiExtensionsFor(
		workspacePath,
	);
	const enabled = await enabledPiExtensionPaths(new Set(disabled));
	paths.splice(0, paths.length, ...builtins, ...enabled);
}
