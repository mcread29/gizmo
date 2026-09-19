import {
	access,
	mkdir,
	mkdtemp,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	loadLinkedExtensionIntegrations,
	loadProjectExtensionIntegrations,
} from '../../src/extensions/load-extensions';

const paths: string[] = [];
afterEach(async () => {
	await Promise.all(
		paths.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

describe('loadLinkedExtensionIntegrations', () => {
	it('reloads changed transitive source without restarting the process', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gizmo-reload-'));
		paths.push(root);
		const dir = join(root, 'fixture');
		await mkdir(dir);
		await writeFile(
			join(dir, 'index.ts'),
			`import { name } from './name'; export const gizmoExtension = { id: 'fixture', name };`,
		);
		await writeFile(join(dir, 'name.ts'), `export const name = 'before';`);
		expect((await loadLinkedExtensionIntegrations(root))[0]?.name).toBe(
			'before',
		);
		await writeFile(join(dir, 'name.ts'), `export const name = 'after';`);
		expect((await loadLinkedExtensionIntegrations(root))[0]?.name).toBe(
			'after',
		);
	});

	it('loads generic Gizmo capabilities exported by a linked Pi extension', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gizmo-linked-extension-'));
		const sourceRoot = await mkdtemp(join(tmpdir(), 'gizmo-source-extension-'));
		paths.push(root, sourceRoot);
		const source = join(sourceRoot, 'index.ts');
		const linked = join(root, 'unity');
		await writeFile(
			source,
			`export default function () {}\nexport const gizmoExtension = { id: 'unity', name: 'Unity' };\n`,
		);
		await symlink(sourceRoot, linked, 'junction');

		await expect(loadLinkedExtensionIntegrations(root)).resolves.toEqual([
			expect.objectContaining({ id: 'unity', name: 'Unity' }),
		]);
	});

	it('ignores ordinary Pi extensions without executing them', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gizmo-linked-extension-'));
		paths.push(root);
		const marker = join(root, 'executed');
		await mkdir(join(root, 'plain'));
		await writeFile(
			join(root, 'plain', 'index.ts'),
			`import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'yes');\nexport default function () {}\n`,
		);

		await expect(loadLinkedExtensionIntegrations(root)).resolves.toEqual([]);
		await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' });
	});
});

describe('loadProjectExtensionIntegrations', () => {
	it('loads explicit file and directory paths tagged with the workspace', async () => {
		const workspace = await mkdtemp(join(tmpdir(), 'gizmo-workspace-'));
		paths.push(workspace);
		const file = join(workspace, 'helper.ts');
		const dir = join(workspace, 'tools', 'extra');
		await mkdir(dir, { recursive: true });
		await writeFile(
			file,
			`export default function () {}\nexport const gizmoExtension = { id: 'helper', name: 'Helper' };\n`,
		);
		await writeFile(
			join(dir, 'index.ts'),
			`export default function () {}\nexport const gizmoExtension = { id: 'extra', name: 'Extra' };\n`,
		);

		await expect(
			loadProjectExtensionIntegrations([file, dir], workspace),
		).resolves.toEqual([
			expect.objectContaining({ id: 'helper', workspaceRoot: workspace }),
			expect.objectContaining({ id: 'extra', workspaceRoot: workspace }),
		]);
	});

	it('skips missing paths without failing the rest', async () => {
		const workspace = await mkdtemp(join(tmpdir(), 'gizmo-workspace-'));
		paths.push(workspace);
		const file = join(workspace, 'helper.ts');
		await writeFile(
			file,
			`export default function () {}\nexport const gizmoExtension = { id: 'helper', name: 'Helper' };\n`,
		);

		await expect(
			loadProjectExtensionIntegrations(
				[join(workspace, 'missing.ts'), file],
				workspace,
			),
		).resolves.toEqual([
			expect.objectContaining({ id: 'helper', workspaceRoot: workspace }),
		]);
	});
});
