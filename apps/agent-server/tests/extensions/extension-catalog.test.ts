import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GizmoServerExtension } from '@gizmo/extensions';
import {
	configureExtensionCatalog,
	mergeExtensionCatalog,
	rescanExtensionCatalog,
} from '../../src/extensions/extension-catalog';
import {
	registerExtensions,
	registeredExtensions,
} from '../../src/extensions/registry';

const paths: string[] = [];
afterEach(async () => {
	registerExtensions([]);
	await Promise.all(
		paths.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

const svelte: GizmoServerExtension = { id: 'svelte', name: 'Svelte' };
const unity: GizmoServerExtension = { id: 'unity', name: 'Configured Unity' };

describe('extension catalog', () => {
	it('lets a linked extension replace a configured one with the same id', () => {
		const linked: GizmoServerExtension = { id: 'unity', name: 'Linked Unity' };
		expect(mergeExtensionCatalog([svelte, unity], [linked])).toEqual([
			svelte,
			linked,
		]);
	});

	it('re-registers the catalog from a rescan of the linked directory', async () => {
		const linkedDir = await mkdtemp(join(tmpdir(), 'gizmo-linked-'));
		const source = await mkdtemp(join(tmpdir(), 'gizmo-source-'));
		paths.push(linkedDir, source);
		configureExtensionCatalog({ configured: [svelte, unity], linkedDir });

		await rescanExtensionCatalog();
		expect(registeredExtensions().map(({ name }) => name)).toEqual([
			'Svelte',
			'Configured Unity',
		]);

		// Linking: a junction appears, as the registry manager creates.
		await writeFile(
			join(source, 'index.ts'),
			`export default function () {}\nexport const gizmoExtension = { id: 'unity', name: 'Linked Unity' };\n`,
		);
		await symlink(source, join(linkedDir, 'unity'), 'junction');
		await rescanExtensionCatalog();
		expect(registeredExtensions().map(({ name }) => name)).toEqual([
			'Svelte',
			'Linked Unity',
		]);

		// Unlinking: the junction goes and the configured entry is back.
		await rm(join(linkedDir, 'unity'), { recursive: true });
		await rescanExtensionCatalog();
		expect(registeredExtensions().map(({ name }) => name)).toEqual([
			'Svelte',
			'Configured Unity',
		]);
	});

	it('re-evaluates edited extension code and disposes the replaced module', async () => {
		const linkedDir = await mkdtemp(join(tmpdir(), 'gizmo-linked-'));
		const source = await mkdtemp(join(tmpdir(), 'gizmo-source-'));
		paths.push(linkedDir, source);
		configureExtensionCatalog({ configured: [], linkedDir });
		const disposed: string[] = [];
		(globalThis as { __gizmoDisposed?: string[] }).__gizmoDisposed = disposed;

		const write = (name: string) =>
			writeFile(
				join(source, 'index.ts'),
				`import { label } from './label.ts';
export default function () {}
export const gizmoExtension = { id: 'edited', name: label, dispose() { globalThis.__gizmoDisposed.push(label); } };
`,
			).then(() =>
				writeFile(
					join(source, 'label.ts'),
					`export const label = '${name}';
`,
				),
			);
		await write('First');
		await symlink(source, join(linkedDir, 'edited'), 'junction');
		await rescanExtensionCatalog();
		expect(registeredExtensions().map(({ name }) => name)).toEqual(['First']);

		// An edit to a dependency, not just the entry, is picked up: the whole
		// graph re-evaluates from disk. The old module is disposed first.
		await write('Second');
		await rescanExtensionCatalog();
		expect(registeredExtensions().map(({ name }) => name)).toEqual(['Second']);
		expect(disposed).toEqual(['First']);
	});
});
