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
		expect((await catalog.piExtensionOverridesFor(project)).disabled).toEqual([
			'paired',
		]);
	});

	it('lets a workspace switch on an extension Pi has globally disabled', async () => {
		const { catalog, project } = await fixture();
		state.enabled = false;
		expect(await catalog.integrationsFor(project)).toEqual([]);
		await catalog.setPiExtension(project, 'paired', true);
		// A workspace that names an extension gets it: the global state is the
		// default, not a gate. Its code has to load too, so the override is
		// reported for the session's extension paths as well.
		expect(
			(await catalog.integrationsFor(project)).map(({ id }) => id),
		).toEqual(['paired']);
		expect((await catalog.piExtensionOverridesFor(project)).enabled).toEqual([
			'paired',
		]);
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
		expect((await catalog.piExtensionOverridesFor(project)).disabled).toEqual([
			'paired',
		]);
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
