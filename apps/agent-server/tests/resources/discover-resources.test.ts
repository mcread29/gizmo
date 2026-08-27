import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { gizmoExtension as svelteExtension } from '@gizmo/svelte/server';
import { discoverResources } from '../../src/resources/resource-catalog';
import { adoptPiResources } from '../../src/resources/resource-paths';
import { registerExtensions } from '../../src/extensions/registry';

beforeAll(() => {
	registerExtensions([svelteExtension]);
});

const paths: string[] = [];
const dataDirEnv = 'GIZMO_DATA_DIR';
const agentDirEnv = 'PI_CODING_AGENT_DIR';

afterEach(async () => {
	delete process.env[dataDirEnv];
	delete process.env[agentDirEnv];
	await Promise.all(
		paths.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

describe('discoverResources', () => {
	it('reads global Pi resources and project resources together', async () => {
		const data = await temporary('gizmo-pi-');
		const project = await temporary('gizmo-project-');
		process.env[agentDirEnv] = data;
		await skill(join(data, 'skills', 'review'), 'review', 'Review changes');
		await skill(
			join(project, '.gizmo', 'skills', 'release'),
			'release',
			'Ship a release',
		);
		await mkdir(join(data, 'prompts'), { recursive: true });
		await writeFile(
			join(data, 'prompts', 'ship.md'),
			'---\ndescription: Ship it\n---\nShip the branch.\n',
		);
		await writeFile(join(data, 'AGENTS.md'), 'Global rules.\n');
		await writeFile(join(project, 'AGENTS.md'), '# Rules\n\nUse tabs.\n');

		const discovery = await discoverResources(project);

		expect(discovery.skills).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'global/review',
					name: 'review',
					description: 'Review changes',
					scope: 'global',
				}),
				expect.objectContaining({ id: 'project/release', scope: 'project' }),
			]),
		);
		expect(discovery.prompts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'ship', scope: 'global' }),
			]),
		);
		expect(discovery.agentsFiles).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					scope: 'global',
					path: join(data, 'AGENTS.md'),
				}),
				expect.objectContaining({
					scope: 'project',
					path: join(project, 'AGENTS.md'),
				}),
			]),
		);
	});

	it('uses Pi global resources and ignores project-local .pi resources', async () => {
		const data = await temporary('gizmo-data-');
		const agentDir = await temporary('gizmo-pi-');
		const project = await temporary('gizmo-project-');
		process.env[dataDirEnv] = data;
		process.env[agentDirEnv] = agentDir;
		await skill(join(data, 'skills', 'review'), 'review', 'Review changes');
		await skill(join(agentDir, 'skills', 'pi-only'), 'pi-only', 'From Pi');
		await mkdir(join(agentDir, 'prompts'), { recursive: true });
		await writeFile(
			join(agentDir, 'prompts', 'pi-only.md'),
			'---\ndescription: From Pi\n---\nNo.\n',
		);
		await writeFile(join(agentDir, 'AGENTS.md'), 'Pi instructions.\n');
		await skill(join(project, '.pi', 'skills', 'legacy'), 'legacy', 'Old');

		const discovery = await discoverResources(project);

		expect(discovery.skills.map(({ name }) => name)).toContain('pi-only');
		expect(discovery.prompts).toEqual([
			expect.objectContaining({ name: 'pi-only', scope: 'global' }),
		]);
		expect(discovery.agentsFiles).toEqual([
			expect.objectContaining({ path: join(agentDir, 'AGENTS.md') }),
		]);
	});

	it('adopts existing Pi skills once, without touching the originals', async () => {
		const data = await temporary('gizmo-data-');
		const agentDir = await temporary('gizmo-pi-');
		await skill(join(agentDir, 'skills', 'review'), 'review', 'Review changes');
		await writeFile(join(agentDir, 'AGENTS.md'), 'Carried over.\n');

		expect(await adoptPiResources(data, agentDir)).toBe(true);
		// A second run is a no-op, so later edits are never overwritten.
		expect(await adoptPiResources(data, agentDir)).toBe(false);

		process.env[agentDirEnv] = agentDir;
		const discovery = await discoverResources();
		expect(discovery.skills.map(({ name }) => name)).toContain('review');
		expect(discovery.agentsFiles).toEqual([
			expect.objectContaining({ path: join(agentDir, 'AGENTS.md') }),
		]);
	});
});

async function skill(dir: string, name: string, description: string) {
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, 'SKILL.md'),
		`---\nname: ${name}\ndescription: ${description}\n---\n\nDo the thing.\n`,
	);
}

async function temporary(prefix: string) {
	const path = await mkdtemp(join(tmpdir(), prefix));
	paths.push(path);
	return path;
}
