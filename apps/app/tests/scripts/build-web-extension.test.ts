import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	buildWebExtension,
	jsonRenderSvelteExports,
} from '@gizmo/extension-build';
import { sharedModules } from '../../src/lib/extensions/runtime/host-modules';

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
	it('shares design helpers and highlighting without bundling host styles', async () => {
		await write(
			'src/web/index.ts',
			`
import '@gizmo/design';
import * as format from '@gizmo/design/format';
import * as highlight from '@gizmo/design/highlight';
export const gizmoWebExtension = { id: 'fixture', format, highlight };
`,
		);
		const out = join(root, 'dist/web.js');
		await buildWebExtension(root, out);
		const code = await readFile(out, 'utf8');
		for (const specifier of [
			'@gizmo/design/format',
			'@gizmo/design/highlight',
		] as const) {
			expect(code).toContain(specifier);
			for (const name of Object.keys(sharedModules[specifier]))
				expect(code).toContain(name);
		}
		expect(code.length).toBeLessThan(10_000);
		expect(code).not.toContain('data-gizmo-extension-style');
	}, 60_000);

	it('keeps the Svelte renderer export list aligned with the pinned package', () => {
		expect([...jsonRenderSvelteExports].sort()).toEqual(
			Object.keys(sharedModules['@json-render/svelte']).sort(),
		);
	});

	it('uses host json-render and Zod without extension-local dependencies', async () => {
		await write(
			'src/web/index.ts',
			`
import { defineCatalog } from '@json-render/core';
import { Renderer, defineRegistry } from '@json-render/svelte';
import { schema } from '@json-render/svelte/schema';
import { z } from 'zod';
export const gizmoWebExtension = { defineCatalog, Renderer, defineRegistry, schema, z };
`,
		);
		const out = join(root, 'dist/web.js');
		await buildWebExtension(root, out);
		const code = await readFile(out, 'utf8');
		expect(code).not.toMatch(/^\s*import\s.*from\s*["']/m);
		for (const specifier of [
			'@json-render/core',
			'@json-render/svelte',
			'@json-render/svelte/schema',
			'zod',
		]) {
			expect(code).toContain(specifier);
		}
		expect(code.length).toBeLessThan(10_000);
	}, 60_000);

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

	it('installs emitted CSS instead of dropping it', async () => {
		// Vite extracts a plain CSS import into a separate asset for library
		// builds; writing only the JS chunk would silently lose every rule.
		await write('src/web/panel.css', '.fixture-panel { color: red; }');
		await write(
			'src/web/index.ts',
			`import './panel.css';
export const gizmoWebExtension = { id: 'fixture' };`,
		);

		const out = join(root, 'dist/web.js');
		await buildWebExtension(root, out);
		const code = await readFile(out, 'utf8');

		expect(code).toContain('fixture-panel');
		expect(code).toContain('data-gizmo-extension-style');
	}, 60_000);
});
