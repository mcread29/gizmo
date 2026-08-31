import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const roots = ['apps', 'packages', 'scripts'];
const extensions = new Set([
	'.cjs',
	'.cs',
	'.css',
	'.js',
	'.jsx',
	'.mjs',
	'.rs',
	'.svelte',
	'.ts',
	'.tsx',
]);
const ignoredDirectories = new Set([
	'.svelte-kit',
	'coverage',
	'dist',
	'node_modules',
	'target',
]);
const targetLines = 250;
const maximumLines = 300;
const files = [];

async function collect(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (ignoredDirectories.has(entry.name)) continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory()) await collect(path);
		else if (extensions.has(extname(entry.name))) files.push(path);
	}
}

await Promise.all(roots.map(collect));
const results = await Promise.all(
	files.map(async (path) => {
		const content = await readFile(path, 'utf8');
		return {
			path: relative(process.cwd(), path).replaceAll('\\', '/'),
			lines: content
				? content.split(/\r?\n/).length - Number(content.endsWith('\n'))
				: 0,
		};
	}),
);
const aboveTarget = results
	.filter(({ lines }) => lines > targetLines)
	.sort((left, right) => right.lines - left.lines);
const oversized = aboveTarget.filter(({ lines }) => lines > maximumLines);

for (const { path, lines } of aboveTarget) {
	const level = lines > maximumLines ? 'error' : 'warning';
	console.log(`${level}: ${path} has ${lines} lines`);
}
if (!aboveTarget.length)
	console.log(`All checked files are <=${targetLines} lines.`);
if (oversized.length) {
	console.error(
		`\n${oversized.length} file(s) exceed the ${maximumLines}-line limit.`,
	);
	process.exitCode = 1;
}
