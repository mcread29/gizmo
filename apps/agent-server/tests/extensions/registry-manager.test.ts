import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { registryStatus } from '../../src/extensions/registry-manager';

const run = promisify(execFile);

const paths = vi.hoisted(() => ({ data: '', clone: '', url: '' }));
vi.mock('../../src/sessions/session-repository', async (original) => ({
	...(await original<typeof import('../../src/sessions/session-repository')>()),
	defaultDataDir: () => paths.data,
}));
vi.mock('../../src/extensions/registry-storage', async (original) => ({
	...(await original<typeof import('../../src/extensions/registry-storage')>()),
	get registryUrl() {
		return paths.url;
	},
}));
vi.mock('../../src/extensions/extension-reload', () => ({
	reloadExtensions: async () => ({}),
}));

let root: string;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'gizmo-registry-manager-'));
	paths.data = root;
	paths.clone = join(root, 'registries', 'gizmo-registry');
	paths.url = join(root, 'remote');

	// A local repository stands in for the registry source.
	const remote = paths.url;
	await mkdir(join(remote, 'extensions', 'unity'), { recursive: true });
	await writeFile(
		join(remote, 'gizmo.registry.json'),
		JSON.stringify({ extensions: [{ id: 'unity', name: 'Unity' }] }),
	);
	await writeFile(
		join(remote, 'extensions', 'unity', 'index.ts'),
		'export default () => {};',
	);
	await run('git', ['init', '-q', '-b', 'main'], { cwd: remote });
	await run('git', ['add', '.'], { cwd: remote });
	await run(
		'git',
		['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'],
		{ cwd: remote },
	);
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('clones the registry on first status and reuses the clone after', async () => {
	const status = await registryStatus();

	expect(status).toMatchObject({
		home: paths.clone,
		url: paths.url,
		extensions: [{ id: 'unity', name: 'Unity', linked: false }],
	});
	expect(status.commit).toMatch(/^[0-9a-f]{7,}$/);

	// The bootstrap is idempotent: a second call neither re-clones nor fails.
	await expect(registryStatus()).resolves.toMatchObject({
		commit: status.commit,
	});
});

it('lets concurrent callers share one clone attempt', async () => {
	const [first, second] = await Promise.all([
		registryStatus(),
		registryStatus(),
	]);

	expect(first).toEqual(second);
});

it('reports an unreachable registry source as an error', async () => {
	paths.url = join(root, 'missing');

	await expect(registryStatus()).rejects.toThrow(
		'Could not install the extension registry',
	);
});
