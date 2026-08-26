import { isAbsolute, relative, resolve, sep } from 'node:path';

/** Returns true when candidate resolves to parent or one of its descendants. */
export function isPathWithin(parent: string, candidate: string) {
	const child = relative(resolve(parent), resolve(candidate));
	return (
		child === '' ||
		(child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child))
	);
}
