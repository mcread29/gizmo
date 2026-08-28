import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { GizmoServerExtension } from '@gizmo/extensions';
import { ProjectCatalog } from '../../src/projects/project-catalog';
import { registerExtensions } from '../../src/extensions/registry';
import { GlobalResourceStore } from '../../src/resources/global-resource-settings';

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

describe('ProjectCatalog', () => {
	it('inherits the global extensions until the workspace overrides them', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await writeFile(
			join(project, 'package.json'),
			JSON.stringify({ devDependencies: { svelte: '5' } }),
		);
		const catalog = new ProjectCatalog(data);

		const detected = await catalog.detect(project);
		expect(detected.domains).toContainEqual({
			id: 'svelte',
			name: 'Svelte',
			root: '.',
		});
		expect(detected.config).toEqual({ version: 1 });

		await catalog.add(project);
		// Registered extensions are on globally, so the project inherits Svelte.
		expect(await catalog.integrationsFor(project)).toEqual([
			{ id: 'svelte', root: '.' },
		]);

		// Turning it off here records an override without touching globals.
		await catalog.setGizmoExtension(project, 'svelte', false);
		expect(await catalog.integrationsFor(project)).toEqual([]);
		expect(
			JSON.parse(
				await readFile(join(project, '.gizmo', 'config.json'), 'utf8'),
			),
		).toMatchObject({
			gizmoExtensions: [{ id: 'svelte', enabled: false }],
		});

		// Clearing the override returns the workspace to the global state.
		await catalog.setGizmoExtension(project, 'svelte', null);
		expect((await catalog.detect(project)).config).toEqual({ version: 1 });
		expect(await catalog.integrationsFor(project)).toEqual([
			{ id: 'svelte', root: '.' },
		]);

		await catalog.remove(project);
		expect(await catalog.list()).toEqual([]);
	});

	it('resolves overrides against the global disabled set', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await writeFile(
			join(data, 'resources.json'),
			JSON.stringify({ disabledGizmoExtensions: ['svelte'] }),
		);
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		expect(await catalog.integrationsFor(project)).toEqual([]);
		await catalog.setGizmoExtension(project, 'svelte', true);
		expect(await catalog.integrationsFor(project)).toEqual([
			{ id: 'svelte', root: '.' },
		]);
	});

	it('refuses overrides for an extension it does not know', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		await expect(
			catalog.setGizmoExtension(project, 'nope', false),
		).rejects.toThrow('Unknown Gizmo extension');
	});

	it('lists installed extensions without detecting a nested workspace type', async () => {
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
			root: '.',
		});

		await expect(catalog.add(project)).resolves.toMatchObject({
			path: project,
		});
	});

	it('migrates a legacy profiles.json into config overrides once', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		await mkdir(join(project, '.gizmo'), { recursive: true });
		await writeFile(
			join(project, '.gizmo', 'profiles.json'),
			JSON.stringify({
				version: 1,
				activeProfileId: 'svelte',
				profiles: [
					{ id: 'default', extensions: [] },
					{
						id: 'svelte',
						extensions: [{ id: 'svelte', root: '.' }],
						skills: [{ id: 'global/review', enabled: true }],
					},
				],
			}),
		);
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		expect((await catalog.detect(project)).config).toMatchObject({
			gizmoExtensions: [{ id: 'svelte', enabled: true }],
			skills: [{ id: 'global/review', enabled: true }],
		});
		expect(await catalog.skillsFor(project)).toEqual([
			{ id: 'global/review', enabled: true },
		]);
		// The legacy file is consumed: only config.json remains.
		await expect(
			readFile(join(project, '.gizmo', 'profiles.json'), 'utf8'),
		).rejects.toThrow();
		// A second read is stable and does not resurrect overrides.
		expect((await catalog.detect(project)).config).toMatchObject({
			gizmoExtensions: [{ id: 'svelte', enabled: true }],
		});
	});

	it('registers legacy projects without deriving extensions from them', async () => {
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
				// Extensions follow the global state; legacy integrations do not.
				integrations: [{ id: 'svelte', root: '.' }],
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
		expect(
			await catalog.search('Widgets', join(project, 'Assets')),
		).toMatchObject({ directories: [{ name: 'Widgets' }] });
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
});

async function temporary(prefix: string) {
	const path = await mkdtemp(join(tmpdir(), prefix));
	paths.push(path);
	return path;
}
