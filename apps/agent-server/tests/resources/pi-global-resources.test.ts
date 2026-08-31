import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { supportsGizmoRuntime } from '../../src/resources/pi-global-resources';

const paths: string[] = [];
afterEach(async () => {
	await Promise.all(
		paths.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

describe('Pi extension Gizmo compatibility', () => {
	it('loads extensions without compatibility metadata', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gizmo-pi-extension-'));
		paths.push(root);

		await expect(supportsGizmoRuntime(root, 'directory')).resolves.toBe(true);
	});

	it('excludes directory extensions marked as TUI-only', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gizmo-pi-extension-'));
		paths.push(root);
		await writeFile(join(root, '.gizmo.json'), '{ "runtime": "tui" }');

		await expect(supportsGizmoRuntime(root, 'directory')).resolves.toBe(false);
	});

	it('supports compatibility metadata for single-file extensions', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gizmo-pi-extension-'));
		paths.push(root);
		const extension = join(root, 'footer.ts');
		await writeFile(extension, 'export default function () {}');
		await writeFile(`${extension}.gizmo.json`, '{ "runtime": "tui" }');

		await expect(supportsGizmoRuntime(extension, 'file')).resolves.toBe(false);
	});
});
