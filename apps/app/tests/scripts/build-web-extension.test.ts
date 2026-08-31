import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildWebExtension } from '../../scripts/build-web-extension';

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'gizmo-web-ext-build-'));
	await mkdir(join(root, 'src/web'), { recursive: true });
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

async function write(path: string, contents: string): Promise<void> {
	await writeFile(join(root, path), contents, 'utf8');
}

describe('buildWebExtension', () => {
	it('produces a standalone module that shares the host Svelte runtime', async () => {
		await write(
			'src/web/Panel.svelte',
			'<script lang="ts">let count = $state(0);</script><button onclick={() => count++}>{count}</button>',
		);
		await write(
			'src/web/index.ts',
			`import Panel from './Panel.svelte';
export const gizmoWebExtension = { id: 'fixture', settings: Panel };`,
		);

		const out = join(root, 'dist/web.js');
		await buildWebExtension(root, out);
		const code = await readFile(out, 'utf8');

		// Nothing left for the host's bundler to resolve: the plugin is loadable
		// by URL alone.
		expect(code).not.toMatch(/^\s*import\s.*from\s*["']/m);
		expect(code).toContain('gizmoWebExtension');
		// Svelte comes from the host, so context and reactivity are shared.
		expect(code).toContain('__gizmoHostModules__');
	}, 60_000);

	it('binds Svelte internals whose names are reserved words', async () => {
		await write(
			'src/web/index.ts',
			`import * as internals from 'svelte/internal/client';
export const gizmoWebExtension = { id: 'fixture', internals };`,
		);

		const out = join(root, 'dist/web.js');
		await buildWebExtension(root, out);
		const code = await readFile(out, 'utf8');

		// `if`, `await` and `try` are exported names; binding them directly would
		// be a syntax error, so they must be renamed in the export clause.
		expect(code).not.toMatch(/\bconst (if|await|try)\b/);
	}, 60_000);
});
