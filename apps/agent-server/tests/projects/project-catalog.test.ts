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
	it('stores the user-selected domain and allows generic everywhere', async () => {
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
		});
		await catalog.add(project, 'generic');
		expect(await catalog.list()).toMatchObject([
			{ path: project, domainId: 'generic' },
		]);
		expect(
			JSON.parse(await readFile(join(data, 'projects.json'), 'utf8')),
		).toHaveLength(1);
	});
});

async function temporary(prefix: string) {
	const path = await mkdtemp(join(tmpdir(), prefix));
	paths.push(path);
	return path;
}
