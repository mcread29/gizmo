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

	it('stores a path inside the workspace relative, and reports it back absolute', async () => {
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
		// Stored relative, so a committed config still works after a clone.
		expect(
			JSON.parse(
				await readFile(join(project, '.gizmo', 'config.json'), 'utf8'),
			),
		).toMatchObject({ piExtensionPaths: [join('tools', 'helper.ts')] });
		expect(await catalog.projectExtensionPaths()).toEqual([
			{ workspaceRoot: project, paths: [extension] },
		]);

		// Clearing removes the section so the project inherits everything.
		await catalog.setProjectExtensionPaths(project, []);
		expect(await catalog.projectExtensionPathsFor(project)).toEqual([]);
		expect(await catalog.projectExtensionPaths()).toEqual([]);
	});

	it('takes a workspace-relative path and keeps an outside one absolute', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		const outside = await temporary('gizmo-elsewhere-');
		const shared = join(outside, 'shared.ts');
		await mkdir(join(project, 'tools'), { recursive: true });
		await writeFile(join(project, 'tools', 'helper.ts'), 'export {};');
		await writeFile(shared, 'export {};');
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		await catalog.setProjectExtensionPaths(project, [
			join('tools', 'helper.ts'),
			shared,
		]);
		expect(await catalog.projectExtensionPathsFor(project)).toEqual([
			shared,
			join(project, 'tools', 'helper.ts'),
		]);
	});

	it('refuses an extension path that is not there', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		await expect(
			catalog.setProjectExtensionPaths(project, ['missing/ext.ts']),
		).rejects.toThrow('does not exist');
		await expect(
			catalog.setProjectExtensionPaths(project, [join(project, 'missing.ts')]),
		).rejects.toThrow('does not exist');
	});

	it('hides a workspace without dropping anything it owns', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);
		await catalog.setSkill(project, 'review', false);

		expect(await catalog.setHidden(project, true)).toMatchObject({
			path: project,
			hidden: true,
		});
		// The row survives a reload, skills and all.
		const reloaded = new ProjectCatalog(data);
		expect(await reloaded.list()).toMatchObject([
			{
				path: project,
				hidden: true,
				skills: [{ id: 'review', enabled: false }],
			},
		]);
		expect(
			JSON.parse(await readFile(join(data, 'projects.json'), 'utf8')),
		).toMatchObject([{ path: project, hidden: true }]);

		// Showing it again clears the flag rather than storing `false`.
		await reloaded.setHidden(project, false);
		const [shown] = JSON.parse(
			await readFile(join(data, 'projects.json'), 'utf8'),
		) as Record<string, unknown>[];
		expect(shown).not.toHaveProperty('hidden');
		expect((await reloaded.list())[0]).not.toHaveProperty('hidden');

		await expect(
			catalog.setHidden(join(project, 'nope'), true),
		).rejects.toThrow('not registered');
	});
});

async function temporary(prefix: string) {
	const path = await mkdtemp(join(tmpdir(), prefix));
	paths.push(path);
	return path;
}

describe('ProjectCatalog compaction policy', () => {
	it('stores the policy in the workspace config and defaults when absent', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		expect(await catalog.compactionFor(project)).toEqual({
			enabled: true,
			fillPercent: 60,
			retainPercent: 0,
		});
		const policy = { enabled: false, fillPercent: 70, retainPercent: 20 };
		expect(await catalog.setCompaction(project, policy)).toEqual(policy);
		expect(await catalog.compactionFor(project)).toEqual(policy);
		expect(
			JSON.parse(
				await readFile(join(project, '.gizmo', 'config.json'), 'utf8'),
			),
		).toMatchObject({ compaction: policy });
	});

	it('rejects retention at or above the threshold and drops malformed policies', async () => {
		const data = await temporary('gizmo-data-');
		const project = await temporary('gizmo-project-');
		const catalog = new ProjectCatalog(data);
		await catalog.add(project);

		await expect(
			catalog.setCompaction(project, {
				enabled: true,
				fillPercent: 30,
				retainPercent: 30,
			}),
		).rejects.toThrow('Retained context must be below');
		await mkdir(join(project, '.gizmo'), { recursive: true });
		await writeFile(
			join(project, '.gizmo', 'config.json'),
			JSON.stringify({ version: 1, compaction: { fillPercent: 'high' } }),
		);
		expect(await catalog.compactionFor(project)).toMatchObject({
			fillPercent: 60,
		});
	});
});
