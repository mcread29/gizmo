import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WorkspaceDomain } from '../types';

export const svelteDomain: WorkspaceDomain = {
	id: 'svelte',
	name: 'Svelte',
	detect: isSvelteWorkspace,
	systemPrompt: `This workspace uses Svelte. Respect its existing Svelte version and conventions. Prefer the project's configured check, test, and build scripts for verification, and do not assume SvelteKit unless its packages or configuration are present.`,
	createTools: () => [],
};

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
