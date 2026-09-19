import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readInstalledState } from '../../src/extensions/registry-storage';

const paths = vi.hoisted(() => ({ data: '', home: '' }));
vi.mock('../../src/sessions/session-repository', async (original) => ({
	...(await original<typeof import('../../src/sessions/session-repository')>()),
	defaultDataDir: () => paths.data,
}));

let root: string;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'gizmo-installed-'));
	paths.data = root;
	paths.home = join(root, 'registries');
	await mkdir(paths.home, { recursive: true });
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

const write = (state: unknown) =>
	writeFile(join(paths.home, 'installed.json'), JSON.stringify(state));

it('reads the flat single-registry state', async () => {
	await write({ linked: ['unity'], commit: 'abc1234' });

	await expect(readInstalledState()).resolves.toEqual({
		linked: ['unity'],
		commit: 'abc1234',
	});
});

it('keeps what an older multi-registry install had linked', async () => {
	await write({
		registries: [
			{ name: 'other', linked: ['ignored'] },
			{ name: 'gizmo-registry', linked: ['unity', 'svelte'], commit: 'abc' },
		],
	});

	await expect(readInstalledState()).resolves.toEqual({
		linked: ['unity', 'svelte'],
		commit: 'abc',
	});
});

it('falls back to the only registry an older install had', async () => {
	await write({
		registries: [{ name: 'gizmo-extensions', linked: ['unity'] }],
	});

	await expect(readInstalledState()).resolves.toEqual({ linked: ['unity'] });
});

it('starts empty when nothing has been installed yet', async () => {
	await expect(readInstalledState()).resolves.toEqual({ linked: [] });
});
