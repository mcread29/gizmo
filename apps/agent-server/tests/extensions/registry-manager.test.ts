import { execFile } from 'node:child_process';
import { lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
	registryLink,
	registryReset,
	registryStatus,
	registryUpdate,
} from '../../src/extensions/registry-manager';
import { registryRef } from '../../src/extensions/registry-storage';

const run = promisify(execFile);

const paths = vi.hoisted(() => ({
	data: '',
	clone: '',
	url: '',
	enabled: '',
	disabled: '',
}));
vi.mock('../../src/sessions/session-repository', async (original) => ({
	...(await original<typeof import('../../src/sessions/session-repository')>()),
	defaultDataDir: () => paths.data,
}));
vi.mock('../../src/extensions/registry-storage', async (original) => ({
	...(await original<typeof import('../../src/extensions/registry-storage')>()),
	get registryUrl() {
		return paths.url;
	},
	extensionsDir: () => paths.enabled,
	disabledExtensionsDir: () => paths.disabled,
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
	paths.enabled = join(root, 'enabled');
	paths.disabled = join(root, 'disabled');

	// A local repository stands in for the registry source.
	const remote = paths.url;
	await mkdir(join(remote, 'extensions', 'unity'), { recursive: true });
	await writeFile(
		join(remote, 'gizmo.registry.json'),
		JSON.stringify({
			gizmoApiVersion: 1,
			extensions: [{ id: 'unity', name: 'Unity' }],
		}),
	);
	await writeFile(
		join(remote, 'extensions', 'unity', 'index.ts'),
		'export default () => {};',
	);
	await run('git', ['init', '-q', '-b', registryRef], { cwd: remote });
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

it('refuses a registry written for another extension API', async () => {
	await writeFile(
		join(paths.url, 'gizmo.registry.json'),
		JSON.stringify({ gizmoApiVersion: 99, extensions: [] }),
	);
	await run('git', ['add', '.'], { cwd: paths.url });
	await run(
		'git',
		['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'bump'],
		{ cwd: paths.url },
	);

	await expect(registryStatus()).rejects.toThrow('extension API 99');
});

it('reset unlinks every installed extension and removes the clone', async () => {
	await registryLink('unity');
	await expect(lstat(join(paths.enabled, 'unity'))).resolves.toBeDefined();

	const status = await registryReset();

	expect(status.extensions).toEqual([]);
	await expect(lstat(paths.clone)).rejects.toMatchObject({ code: 'ENOENT' });
	await expect(lstat(join(paths.enabled, 'unity'))).rejects.toMatchObject({
		code: 'ENOENT',
	});
});

it('leaves the installed checkout intact when an update targets another API', async () => {
	const before = await registryStatus();
	await writeFile(
		join(paths.url, 'gizmo.registry.json'),
		JSON.stringify({ gizmoApiVersion: 99, extensions: [] }),
	);
	await run('git', ['add', '.'], { cwd: paths.url });
	await run(
		'git',
		[
			'-c',
			'user.email=t@t',
			'-c',
			'user.name=t',
			'commit',
			'-qm',
			'incompatible',
		],
		{ cwd: paths.url },
	);
	await expect(registryUpdate()).rejects.toThrow('extension API 99');
	const after = await registryStatus();
	expect(after.commit).toBe(before.commit);
	expect(after.extensions).toEqual(before.extensions);
});
