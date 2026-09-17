import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectCatalog } from '../../src/projects/project-catalog';
import { registerExtensions } from '../../src/extensions/registry';

const state = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/resources/pi-global-resources', async (original) => {
	const list = async () =>
		['paired', 'web-only'].map((id) => ({
			id,
			name: id,
			path: `/extensions/${id}`,
			kind: 'directory',
			enabled: state.enabled,
		}));
	return {
		...(await original<
			typeof import('../../src/resources/pi-global-resources')
		>()),
		listPiExtensions: list,
		listGizmoCompatiblePiExtensions: list,
	};
});

const roots: string[] = [];
beforeEach(() => {
	state.enabled = true;
	registerExtensions([{ id: 'paired', name: 'Paired' }]);
});
afterEach(async () => {
	registerExtensions([]);
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'gizmo-enablement-'));
	roots.push(root);
	const project = join(root, 'project');
	await mkdir(project);
	const catalog = new ProjectCatalog(root);
	await catalog.add(project);
	return { catalog, project };
}

describe('paired extension enablement', () => {
	it('uses Pi state for server integrations and web-only companions', async () => {
		const { catalog, project } = await fixture();
		expect(
			(await catalog.integrationsFor(project)).map(({ id }) => id),
		).toEqual(['paired', 'web-only']);
		await catalog.setPiExtension(project, 'paired', false);
		expect(
			(await catalog.integrationsFor(project)).map(({ id }) => id),
		).toEqual(['web-only']);
		expect(await catalog.disabledPiExtensionsFor(project)).toEqual(['paired']);
		state.enabled = false;
		await catalog.setPiExtension(project, 'paired', true);
		expect(await catalog.integrationsFor(project)).toEqual([]);
	});
	it('migrates a legacy paired toggle on write and respects it before migration', async () => {
		const { catalog, project } = await fixture();
		await mkdir(join(project, '.gizmo'));
		await writeFile(
			join(project, '.gizmo/config.json'),
			JSON.stringify({
				version: 1,
				gizmoExtensions: [{ id: 'paired', enabled: false }],
			}),
		);
		expect(await catalog.disabledPiExtensionsFor(project)).toEqual(['paired']);
		expect(
			(await catalog.integrationsFor(project)).map(({ id }) => id),
		).toEqual(['web-only']);
		await catalog.setGizmoExtension(project, 'paired', true);
		const config = JSON.parse(
			await readFile(join(project, '.gizmo/config.json'), 'utf8'),
		);
		expect(config.gizmoExtensions).toBeUndefined();
		expect(config.piExtensions).toEqual([{ id: 'paired', enabled: true }]);
	});
});
