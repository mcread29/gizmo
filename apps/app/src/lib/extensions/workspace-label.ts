export function workspaceNameFromPath(path: string | undefined) {
	return path?.split(/[\\/]/).filter(Boolean).at(-1);
}
