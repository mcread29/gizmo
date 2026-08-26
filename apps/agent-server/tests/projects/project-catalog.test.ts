import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { gizmoExtension as svelteExtension } from '@gizmo/svelte/server';
import { ProjectCatalog } from '../../src/projects/project-catalog';
import { registerExtensions } from '../../src/extensions/registry';

beforeAll(() => {
	registerExtensions([svelteExtension]);
});

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
		expect(
			JSON.parse(
				await readFile(join(project, '.gizmo', 'profiles.json'), 'utf8'),
			),
		).toMatchObject({
			activeProfileId: 'svelte',
			profiles: [
				{ id: 'default', extensions: [] },
				{ id: 'svelte', extensions: [{ id: 'svelte', root: '.' }] },
			],
		});
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

		const catalog = new ProjectCatalog(data);
		expect((await catalog.detect(project)).domains).toContainEqual({
			id: 'svelte',
			name: 'Svelte',
			detected: true,
			root: join('apps', 'app'),
		});

		await expect(
			catalog.add(project, [{ id: 'svelte', root: join('apps', 'app') }]),
		).resolves.toMatchObject({ path: project });
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

		expect(await new ProjectCatalog(data).list()).toMatchObject([
			{
				title: 'Legacy game',
				path: project,
				integrations: [{ id: 'unity', root: '.' }],
				activeProfileId: 'unity',
				profiles: [
					{ id: 'default', extensions: [] },
					{ id: 'unity', extensions: [{ id: 'unity', root: '.' }] },
				],
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
	it('only matches immediate children, never recursing into subfolders', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await mkdir(join(project, 'Assets', 'Widgets'), { recursive: true });
		const catalog = new ProjectCatalog(data);

		expect(await catalog.search('Widgets', project)).toMatchObject({
			directories: [],
		});
		expect(await catalog.search('Widgets', join(project, 'Assets'))).toMatchObject(
			{ directories: [{ name: 'Widgets' }] },
		);
	});

	it('only matches an actual substring, not a loose subsequence', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await mkdir(join(project, 'repos'));
		await mkdir(join(project, 'Crash Reports'));
		const catalog = new ProjectCatalog(data);

		const { directories } = await catalog.search('repos', project);
		expect(directories.map((entry) => entry.name)).toEqual(['repos']);
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
