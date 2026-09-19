import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	configureExtensionCatalog,
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

describe('extension catalog', () => {
	it('re-registers the catalog from a rescan of the linked directory', async () => {
		const linkedDir = await mkdtemp(join(tmpdir(), 'gizmo-linked-'));
		const source = await mkdtemp(join(tmpdir(), 'gizmo-source-'));
		paths.push(linkedDir, source);
		configureExtensionCatalog({ linkedDir });

		await rescanExtensionCatalog();
		expect(registeredExtensions()).toEqual([]);

		// Linking: a junction appears, as the registry manager creates.
		await writeFile(
			join(source, 'index.ts'),
			`export default function () {}\nexport const gizmoExtension = { id: 'unity', name: 'Linked Unity' };\n`,
		);
		await symlink(source, join(linkedDir, 'unity'), 'junction');
		await rescanExtensionCatalog();
		expect(registeredExtensions().map(({ name }) => name)).toEqual([
			'Linked Unity',
		]);

		// Unlinking: the junction goes and so does the extension.
		await rm(join(linkedDir, 'unity'), { recursive: true });
		await rescanExtensionCatalog();
		expect(registeredExtensions()).toEqual([]);
	});

	it('re-evaluates edited extension code and disposes the replaced module', async () => {
		const linkedDir = await mkdtemp(join(tmpdir(), 'gizmo-linked-'));
		const source = await mkdtemp(join(tmpdir(), 'gizmo-source-'));
		paths.push(linkedDir, source);
		configureExtensionCatalog({ linkedDir });
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
