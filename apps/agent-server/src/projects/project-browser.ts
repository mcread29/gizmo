import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export async function browseProjects(input = homedir()) {
	const path = await requireDirectory(input);
	const entries = await readdir(path, { withFileTypes: true });
	const parent = dirname(path);
	return {
		path,
		...(parent !== path ? { parent } : {}),
		directories: entries
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
			.sort((left, right) => left.name.localeCompare(right.name))
			.map((entry) => ({ name: entry.name, path: join(path, entry.name) })),
	};
}

/**
 * Lists the folders directly inside `root` that contain `query`. This is
 * intentionally non-recursive so it behaves like shell tab completion.
 */
export async function searchProjects(query: string, root = homedir()) {
	const path = await requireDirectory(root);
	const needle = query.trim().toLowerCase();
	const entries = await readdir(path, { withFileTypes: true });
	const matches = entries.flatMap((entry) => {
		if (!entry.isDirectory() || entry.name.startsWith('.')) return [];
		const score = matchScore(entry.name.toLowerCase(), needle);
		if (score < 0) return [];
		return [{ name: entry.name, path: join(path, entry.name), score }];
	});

	matches.sort(
		(left, right) =>
			right.score - left.score || left.name.localeCompare(right.name),
	);
	return {
		path,
		directories: matches.map(({ name, path: entryPath }) => ({
			name,
			path: entryPath,
		})),
	};
}

export async function requireDirectory(input: string) {
	if (!isAbsolute(input)) throw new Error('Project path must be absolute');
	const path = resolve(input);
	if (!(await stat(path)).isDirectory()) {
		throw new Error('Project path is not a directory');
	}
	return path;
}

/** Returns -1 for no match; otherwise higher values are better matches. */
function matchScore(name: string, needle: string) {
	if (!needle) return 0;
	if (name === needle) return 3;
	if (name.startsWith(needle)) return 2;
	return name.includes(needle) ? 1 : -1;
}
