import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectCatalog } from '../../src/projects/project-catalog';

const paths: string[] = [];
afterEach(async () =>
	Promise.all(paths.splice(0).map((path) => rm(path, { recursive: true }))),
);

describe('ProjectCatalog', () => {
	it('stores the selected workspace integrations', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await writeFile(
			join(project, 'package.json'),
			JSON.stringify({ devDependencies: { svelte: '5' } }),
		);
		const catalog = new ProjectCatalog(data);

		expect((await catalog.detect(project)).domains).toContainEqual({
			id: 'svelte',
			name: 'Svelte',
			detected: true,
			root: '.',
		});
		await catalog.add(project, [{ id: 'svelte', root: '.' }]);
		expect(await catalog.list()).toMatchObject([
			{ path: project, integrations: [{ id: 'svelte', root: '.' }] },
		]);
		expect(
			JSON.parse(await readFile(join(data, 'projects.json'), 'utf8')),
		).toHaveLength(1);
		await catalog.remove(project);
		expect(await catalog.list()).toEqual([]);
	});

	it('detects a Svelte app nested in a monorepo', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await mkdir(join(project, 'apps', 'app'), { recursive: true });
		await writeFile(
			join(project, 'apps', 'app', 'package.json'),
			JSON.stringify({ dependencies: { svelte: '^5.0.0' } }),
		);

		expect(
			(await new ProjectCatalog(data).detect(project)).domains,
		).toContainEqual({
			id: 'svelte',
			name: 'Svelte',
			detected: true,
			root: join('apps', 'app'),
		});
	});

	it('reads projects saved with the old single-domain format', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await writeFile(
			join(data, 'projects.json'),
			JSON.stringify([
				{
					title: 'Legacy game',
					path: project,
					domainId: 'unity',
					addedAt: 1,
				},
			]),
		);

		expect(await new ProjectCatalog(data).list()).toEqual([
			{
				title: 'Legacy game',
				path: project,
				integrations: [{ id: 'unity', root: '.' }],
				addedAt: 1,
			},
		]);
	});

	it('lists folders for the web workspace picker', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await mkdir(join(project, 'Game'));
		await mkdir(join(project, 'WebFrontend'));
		await writeFile(join(project, 'README.md'), 'not a directory');

		expect(await new ProjectCatalog(data).browse(project)).toMatchObject({
			path: project,
			directories: [
				{ name: 'Game', path: join(project, 'Game') },
				{ name: 'WebFrontend', path: join(project, 'WebFrontend') },
			],
		});
	});
	it('stores per-workspace skill overrides and keeps them across edits', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await writeFile(join(project, 'package.json'), '{}');
		const catalog = new ProjectCatalog(data);
		await catalog.add(project, []);

		await catalog.setSkill(project, 'global/review', true);
		expect(await catalog.skillsFor(project)).toEqual([
			{ id: 'global/review', enabled: true },
		]);

		// Re-adding the workspace to change integrations keeps skill state.
		await catalog.add(project, []);
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
});

async function temporary(prefix: string) {
	const path = await mkdtemp(join(tmpdir(), prefix));
	paths.push(path);
	return path;
}
