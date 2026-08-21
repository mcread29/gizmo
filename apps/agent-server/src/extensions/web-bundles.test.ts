import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GizmoServerExtension } from '@gizmo/extensions';
import { webBundlePath, webExtensionBundles } from './web-bundles';

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'gizmo-web-bundle-'));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

function extension(packageRoot?: string, id = 'example'): GizmoServerExtension {
	return { id, name: 'Example', ...(packageRoot ? { packageRoot } : {}) };
}

async function writeBundle(code: string): Promise<void> {
	await mkdir(join(root, 'dist'), { recursive: true });
	await writeFile(webBundlePath(root), code, 'utf8');
}

describe('webExtensionBundles', () => {
	it('returns the built bundle of an extension that ships one', async () => {
		await writeBundle('export const gizmoWebExtension = {};');

		await expect(webExtensionBundles([extension(root)])).resolves.toEqual({
			bundles: [
				{ id: 'example', code: 'export const gizmoWebExtension = {};' },
			],
			diagnostics: [],
		});
	});

	it('skips an extension with no package root', async () => {
		await expect(webExtensionBundles([extension()])).resolves.toEqual({
			bundles: [],
			diagnostics: [],
		});
	});

	it('skips an extension whose bundle has not been built', async () => {
		await expect(webExtensionBundles([extension(root)])).resolves.toEqual({
			bundles: [],
			diagnostics: [],
		});
	});

	it('reports rather than serves an implausibly large bundle', async () => {
		await writeBundle('x'.repeat(9 * 1024 * 1024));
		const result = await webExtensionBundles([extension(root)]);

		expect(result.bundles).toEqual([]);
		expect(result.diagnostics[0]).toContain('too large');
	});
});
