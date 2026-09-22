import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectCatalog } from '../../src/projects/project-catalog';
import { discoverWorkspaceExtensions } from '../../src/projects/workspace-extensions';

async function temporary(prefix: string) {
	return mkdtemp(join(tmpdir(), prefix));
}

/** A workspace with the given entries in its `.gizmo/extensions` folder. */
async function workspace(entries: { dirs?: string[]; files?: string[] } = {}) {
	const project = await temporary('gizmo-project-');
	const dir = join(project, '.gizmo', 'extensions');
	await mkdir(dir, { recursive: true });
	for (const name of entries.dirs ?? []) {
		await mkdir(join(dir, name), { recursive: true });
		await writeFile(join(dir, name, 'index.ts'), 'export {};');
	}
	for (const name of entries.files ?? []) {
		await writeFile(join(dir, name), 'export {};');
	}
	return { project, dir };
}

describe('workspace extensions', () => {
	it('offers nothing when the workspace has no extensions folder', async () => {
		const project = await temporary('gizmo-project-');
		expect(await discoverWorkspaceExtensions(project)).toEqual([]);
	});

	it('lists folders, scripts, and links, and ignores anything else', async () => {
		const { project, dir } = await workspace({
			dirs: ['build-pipeline'],
			files: ['scene-notes.ts', 'README.md'],
		});
		await symlink(
			join(project, '.gizmo', 'extensions', 'build-pipeline'),
			join(dir, 'aliased'),
			'dir',
		);
		// A link is judged by what it points at: a README is not a script.
		await symlink(join(dir, 'README.md'), join(dir, 'notes'), 'file');
		await symlink(join(dir, 'missing'), join(dir, 'dangling'), 'dir');

		expect(await discoverWorkspaceExtensions(project)).toEqual([
			{ id: 'aliased', path: '.gizmo/extensions/aliased' },
			{
				id: 'build-pipeline',
				path: '.gizmo/extensions/build-pipeline',
			},
			{
				id: 'scene-notes.ts',
				path: '.gizmo/extensions/scene-notes.ts',
			},
		]);
	});

	it('reports what it found without loading any of it', async () => {
		const data = await temporary('gizmo-data-');
		const { project } = await workspace({ dirs: ['build-pipeline'] });
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		const detected = await catalog.detect(project);
		expect(detected.workspaceExtensions).toEqual([
			{
				id: 'build-pipeline',
				path: '.gizmo/extensions/build-pipeline',
			},
		]);
		// Present is not loaded: the path list is still empty.
		expect(detected.config?.piExtensionPaths).toBeUndefined();
		expect(await catalog.projectExtensionPathsFor(project)).toEqual([]);
	});

	it('loads a discovered extension once its path is listed', async () => {
		const data = await temporary('gizmo-data-');
		const { project } = await workspace({ dirs: ['build-pipeline'] });
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);
		const [found] = await discoverWorkspaceExtensions(project);

		await catalog.setProjectExtensionPaths(project, [found.path]);

		expect(await catalog.projectExtensionPathsFor(project)).toEqual([
			join(project, '.gizmo', 'extensions', 'build-pipeline'),
		]);
		expect((await catalog.configFor(project)).piExtensionPaths).toEqual([
			found.path,
		]);
	});

	it('stores a path inside the workspace relative and /-separated', async () => {
		const data = await temporary('gizmo-data-');
		const { project } = await workspace({ dirs: ['build-pipeline'] });
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		await catalog.setProjectExtensionPaths(project, [
			join(project, '.gizmo', 'extensions', 'build-pipeline'),
		]);

		expect((await catalog.configFor(project)).piExtensionPaths).toEqual([
			'.gizmo/extensions/build-pipeline',
		]);
	});

	it('reads a config written on Windows the same way', async () => {
		const data = await temporary('gizmo-data-');
		const { project } = await workspace({ dirs: ['build-pipeline'] });
		await writeFile(
			join(project, '.gizmo', 'config.json'),
			JSON.stringify({
				version: 1,
				piExtensionPaths: ['.gizmo\\extensions\\build-pipeline'],
			}),
		);
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		expect((await catalog.configFor(project)).piExtensionPaths).toEqual([
			'.gizmo/extensions/build-pipeline',
		]);
		expect(await catalog.projectExtensionPathsFor(project)).toEqual([
			join(project, '.gizmo', 'extensions', 'build-pipeline'),
		]);
		// And the workspace stays writable: validation finds the folder.
		await catalog.setProjectExtensionPaths(project, []);
	});
});
