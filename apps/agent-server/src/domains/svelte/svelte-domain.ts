import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { WorkspaceDomain } from '../types';

export const svelteDomain: WorkspaceDomain = {
	id: 'svelte',
	name: 'Svelte',
	detect: isSvelteWorkspace,
	detectRoots: findSvelteRoots,
	systemPrompt: `This workspace uses Svelte. Respect its existing Svelte version and conventions. Prefer the project's configured check, test, and build scripts for verification, and do not assume SvelteKit unless its packages or configuration are present.`,
	createTools: () => [],
};

async function findSvelteRoots(workspacePath: string): Promise<string[]> {
	const matches: string[] = [];
	const pending = [{ path: workspacePath, depth: 0 }];
	while (pending.length) {
		const candidate = pending.shift();
		if (!candidate) break;
		if (await isSvelteWorkspace(candidate.path)) {
			matches.push(candidate.path);
			continue;
		}
		if (candidate.depth >= maxSearchDepth) continue;
		try {
			const entries = await readdir(candidate.path, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory() || ignoredDirectories.has(entry.name))
					continue;
				pending.push({
					path: join(candidate.path, entry.name),
					depth: candidate.depth + 1,
				});
			}
		} catch {
			// An unreadable subdirectory does not invalidate the workspace.
		}
	}
	return matches;
}

const maxSearchDepth = 3;
const ignoredDirectories = new Set([
	'.git',
	'.svelte-kit',
	'Library',
	'Logs',
	'Temp',
	'bin',
	'build',
	'coverage',
	'dist',
	'node_modules',
	'obj',
]);

async function isSvelteWorkspace(workspacePath: string): Promise<boolean> {
	try {
		const manifest = JSON.parse(
			await readFile(join(workspacePath, 'package.json'), 'utf8'),
		) as Record<string, unknown>;
		const dependencies = {
			...record(manifest.dependencies),
			...record(manifest.devDependencies),
		};
		return typeof dependencies.svelte === 'string';
	} catch {
		return false;
	}
}

function record(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === 'object'
		? (value as Record<string, unknown>)
		: {};
}
