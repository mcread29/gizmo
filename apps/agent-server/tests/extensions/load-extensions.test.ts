import { access, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadLinkedExtensionIntegrations } from '../../src/extensions/load-extensions';

const paths: string[] = [];
afterEach(async () => {
	await Promise.all(
		paths.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

describe('loadLinkedExtensionIntegrations', () => {
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
		await writeFile(
			join(root, 'plain.ts'),
			`import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'yes');\nexport default function () {}\n`,
		);

		await expect(loadLinkedExtensionIntegrations(root)).resolves.toEqual([]);
		await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' });
	});
});
