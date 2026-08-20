import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectCatalog } from '../../src/projects/project-catalog';
import { GlobalResourceStore } from '../../src/resources/global-resource-settings';
import {
	ResourceCatalogService,
	type Discovery,
} from '../../src/resources/resource-catalog';

const paths: string[] = [];
afterEach(async () =>
	Promise.all(paths.splice(0).map((path) => rm(path, { recursive: true }))),
);

describe('ResourceCatalogService', () => {
	it('installs discovered skills globally but leaves them disabled', async () => {
		const { service } = await setup();

		const catalog = await service.list();

		expect(catalog.skills).toEqual([
			{
				id: 'global/review',
				name: 'review',
				description: 'Review changes',
				scope: 'global',
				path: '/home/dev/.gizmo/skills/review/SKILL.md',
				source: 'user',
				installed: true,
				enabledGlobally: false,
				enabled: false,
			},
		]);
	});

	it('enables a skill for every workspace from the global setting', async () => {
		const { service, project } = await setup();

		await service.setGlobalSkill('global/review', { enabled: true });

		expect(await service.enabledSkillPaths(project)).toEqual([
			'/home/dev/.gizmo/skills/review/SKILL.md',
		]);
	});

	it('lets a workspace override the global setting in both directions', async () => {
		const { service, project } = await setup();

		await service.setProjectSkill(project, 'global/review', true);
		expect(await service.enabledSkillPaths(project)).toEqual([
			'/home/dev/.gizmo/skills/review/SKILL.md',
		]);
		expect((await service.list(project)).skills[0]).toMatchObject({
			enabled: true,
			enabledGlobally: false,
			override: true,
		});

		await service.setGlobalSkill('global/review', { enabled: true });
		await service.setProjectSkill(project, 'global/review', false);
		expect(await service.enabledSkillPaths(project)).toEqual([]);
	});

	it('restores the global setting when an override is cleared', async () => {
		const { service, project } = await setup();
		await service.setGlobalSkill('global/review', { enabled: true });
		await service.setProjectSkill(project, 'global/review', false);

		const catalog = await service.setProjectSkill(
			project,
			'global/review',
			null,
		);

		expect(catalog.skills[0]).toMatchObject({ enabled: true });
		expect(catalog.skills[0]).not.toHaveProperty('override');
	});

	it('uninstalling a skill disables it everywhere', async () => {
		const { service, project } = await setup();
		await service.setGlobalSkill('global/review', { enabled: true });
		await service.setProjectSkill(project, 'global/review', true);

		const catalog = await service.setGlobalSkill(
			'global/review',
			{ installed: false },
			project,
		);

		expect(catalog.skills[0]).toMatchObject({
			installed: false,
			enabled: false,
		});
		expect(await service.enabledSkillPaths(project)).toEqual([]);
	});

	it('reports the read-only resources it discovered', async () => {
		const { service } = await setup();

		const catalog = await service.list();

		expect(catalog.agentsFiles).toHaveLength(1);
		expect(catalog.prompts).toHaveLength(1);
		expect(catalog.diagnostics).toEqual(['duplicate skill name']);
	});
});

async function setup() {
	const data = await temporary('gizmo-data-');
	const project = await temporary('gizmo-project-');
	await writeFile(join(project, 'package.json'), '{}');
	const projects = new ProjectCatalog(data);
	await projects.add(project, []);
	const service = new ResourceCatalogService(
		projects,
		new GlobalResourceStore(data),
		async () => discovery,
	);
	return { service, projects, project, data };
}

const discovery: Discovery = {
	skills: [
		{
			id: 'global/review',
			name: 'review',
			description: 'Review changes',
			scope: 'global',
			path: '/home/dev/.gizmo/skills/review/SKILL.md',
			source: 'user',
		},
	],
	agentsFiles: [
		{
			id: 'agents:/home/dev/.gizmo/AGENTS.md',
			name: 'AGENTS.md',
			scope: 'global',
			path: '/home/dev/.gizmo/AGENTS.md',
		},
	],
	prompts: [
		{
			id: 'prompt:/home/dev/.gizmo/prompts/ship.md',
			name: 'ship',
			scope: 'global',
			path: '/home/dev/.gizmo/prompts/ship.md',
		},
	],
	diagnostics: ['duplicate skill name'],
};

async function temporary(prefix: string) {
	const path = await mkdtemp(join(tmpdir(), prefix));
	paths.push(path);
	return path;
}
