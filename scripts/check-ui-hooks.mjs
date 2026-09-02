import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const roots = ['apps/app/src', 'packages/ui/src', 'packages/design/src'];
const markupExtensions = new Set(['.svelte', '.ts']);
const styleExtensions = new Set(['.css']);
const ignoredDirectories = new Set([
	'.svelte-kit',
	'build',
	'coverage',
	'dist',
	'node_modules',
]);

const markupHookPattern = /data-ui=(["'])([^"']+)\1/g;
/*
 * A hook can also be chosen at runtime — `data-ui={error ? 'a' : 'b'}` — so
 * every quoted string inside such an expression counts as used. Without this the
 * check reports a live hook as dead the moment a component picks between two.
 */
const markupExpressionPattern = /data-ui=\{([^}]*)\}/g;
const quotedPattern = /(["'])([^"'\n]+)\1/g;
const cssHookPattern = /\[data-ui=(["'])([^"']+)\1\]/g;

const markupFiles = [];
const styleFiles = [];

async function collect(directory) {
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (ignoredDirectories.has(entry.name)) continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory()) await collect(path);
		else if (markupExtensions.has(extname(entry.name))) markupFiles.push(path);
		else if (styleExtensions.has(extname(entry.name))) styleFiles.push(path);
	}
}

await Promise.all(roots.map(collect));

const markupHooks = new Set();
for (const path of markupFiles) {
	const content = await readFile(path, 'utf8');
	for (const match of content.matchAll(markupHookPattern)) {
		markupHooks.add(match[2]);
	}
	for (const match of content.matchAll(markupExpressionPattern)) {
		for (const quoted of match[1].matchAll(quotedPattern)) {
			markupHooks.add(quoted[2]);
		}
	}
}

const cssHooks = new Map();
for (const path of styleFiles) {
	const content = await readFile(path, 'utf8');
	for (const match of content.matchAll(cssHookPattern)) {
		const hook = match[2];
		const relativePath = relative(process.cwd(), path).replaceAll('\\', '/');
		if (!cssHooks.has(hook)) cssHooks.set(hook, new Set());
		cssHooks.get(hook).add(relativePath);
	}
}

const deadHooks = [...cssHooks.keys()]
	.filter((hook) => !markupHooks.has(hook))
	.sort();

for (const hook of deadHooks) {
	const files = [...cssHooks.get(hook)].sort().join(', ');
	console.log(
		`error: [data-ui='${hook}'] has no markup use (styled in ${files})`,
	);
}
if (!deadHooks.length) {
	console.log('All styled data-ui hooks are used in markup.');
}
if (deadHooks.length) {
	console.error(
		`\n${deadHooks.length} dead data-ui hook(s) styled but not used in markup.`,
	);
	process.exitCode = 1;
}
