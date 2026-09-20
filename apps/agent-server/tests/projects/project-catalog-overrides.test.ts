import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { GizmoServerExtension } from '@gizmo/extension-api';
import { ProjectCatalog } from '../../src/projects/project-catalog';
import { registerExtensions } from '../../src/extensions/registry';
import { GlobalResourceStore } from '../../src/resources/global-resource-settings';

vi.mock('../../src/resources/pi-global-resources', async (original) => ({
	...(await original<
		typeof import('../../src/resources/pi-global-resources')
	>()),
	listPiExtensions: async () => [],
}));

const svelteExtension: GizmoServerExtension = {
	id: 'svelte',
	name: 'Svelte',
};

beforeAll(() => {
	registerExtensions([svelteExtension]);
});

const paths: string[] = [];
afterEach(async () =>
	Promise.all(paths.splice(0).map((path) => rm(path, { recursive: true }))),
);

describe('ProjectCatalog overrides', () => {
	it('stores per-workspace skill overrides and keeps them across edits', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await writeFile(join(project, 'package.json'), '{}');
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		await catalog.setSkill(project, 'global/review', true);
		expect(await catalog.skillsFor(project)).toEqual([
			{ id: 'global/review', enabled: true },
		]);

		// Re-adding the workspace to change integrations keeps skill state.
		await catalog.add(project);
		expect(await catalog.skillsFor(project)).toEqual([
			{ id: 'global/review', enabled: true },
		]);

		await catalog.setSkill(project, 'global/review', null);
		expect(await catalog.skillsFor(project)).toEqual([]);
	});

	it('refuses skill overrides for a workspace it does not know', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');

		await expect(
			new ProjectCatalog(data).setSkill(project, 'global/review', true),
		).rejects.toThrow('not registered');
	});

	it('stores explicit per-project extension paths and reports them back', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		const extension = join(project, 'tools', 'helper.ts');
		await mkdir(join(project, 'tools'), { recursive: true });
		await writeFile(extension, 'export default () => {};');
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		expect(await catalog.projectExtensionPathsFor(project)).toEqual([]);
		await catalog.setProjectExtensionPaths(project, [extension]);
		expect(await catalog.projectExtensionPathsFor(project)).toEqual([
			extension,
		]);
		expect(
			JSON.parse(
				await readFile(join(project, '.gizmo', 'config.json'), 'utf8'),
			),
		).toMatchObject({ piExtensionPaths: [extension] });
		expect(await catalog.projectExtensionPaths()).toEqual([
			{ workspaceRoot: project, paths: [extension] },
		]);

		// Clearing removes the section so the project inherits everything.
		await catalog.setProjectExtensionPaths(project, []);
		expect(await catalog.projectExtensionPathsFor(project)).toEqual([]);
		expect(await catalog.projectExtensionPaths()).toEqual([]);
	});

	it('refuses extension paths that are relative or missing', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		await expect(
			catalog.setProjectExtensionPaths(project, ['relative/ext.ts']),
		).rejects.toThrow('must be absolute');
		await expect(
			catalog.setProjectExtensionPaths(project, [join(project, 'missing.ts')]),
		).rejects.toThrow('does not exist');
	});
});

async function temporary(prefix: string) {
	const path = await mkdtemp(join(tmpdir(), prefix));
	paths.push(path);
	return path;
}
