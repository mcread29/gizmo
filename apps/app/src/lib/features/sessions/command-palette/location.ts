export interface SplitLocation {
	root: string | undefined;
	filter: string;
}

/**
 * Splits an address-bar value into the directory to browse and the child-name
 * filter. Text after a resolved root filters its children until a separator
 * makes that text the next directory to browse.
 */
export function splitLocation(
	value: string,
	knownRoot: string | undefined,
): SplitLocation {
	const separator = value.includes('\\') ? '\\' : '/';
	if (
		knownRoot &&
		(value === knownRoot || value.startsWith(knownRoot + separator))
	) {
		const rest = value.slice(knownRoot.length).replace(/^[\\/]+/, '');
		const lastSeparator = Math.max(
			rest.lastIndexOf('/'),
			rest.lastIndexOf('\\'),
		);
		if (lastSeparator === -1) return { root: knownRoot, filter: rest };
		return {
			root: `${knownRoot.replace(/[\\/]+$/, '')}${separator}${rest.slice(0, lastSeparator)}`,
			filter: rest.slice(lastSeparator + 1),
		};
	}

	const lastSeparator = Math.max(
		value.lastIndexOf('/'),
		value.lastIndexOf('\\'),
	);
	if (lastSeparator === -1) return { root: knownRoot, filter: value };
	return {
		root: value.slice(0, lastSeparator) || separator,
		filter: value.slice(lastSeparator + 1),
	};
}

export function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
