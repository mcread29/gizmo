import {
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
	syncExtension,
	unlinkExtension,
} from '../../src/extensions/registry-links';

const paths = vi.hoisted(() => ({ enabled: '', disabled: '', web: '' }));
vi.mock('../../src/extensions/registry-storage', async (original) => ({
	...(await original<typeof import('../../src/extensions/registry-storage')>()),
	extensionsDir: () => paths.enabled,
	disabledExtensionsDir: () => paths.disabled,
	extensionWebDir: () => paths.web,
}));
let root: string;
let source: string;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'gizmo-links-'));
	paths.enabled = join(root, 'enabled');
	paths.disabled = join(root, 'disabled');
	paths.web = join(root, 'web');
	source = join(root, 'extensions/fixture');
	for (const dir of [paths.disabled, paths.web, source])
		await mkdir(dir, { recursive: true });
	await writeFile(join(source, 'index.ts'), 'export default () => {};');
	await writeFile(
		join(source, 'gizmo.json'),
		JSON.stringify({ apiVersion: 1, web: false, capabilities: ['pi'] }),
	);
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('keeps a disabled link disabled during refresh and removes it on uninstall', async () => {
	await symlink(source, join(paths.disabled, 'fixture'), 'junction');
	await writeFile(join(paths.web, 'fixture.web.js'), 'stale');
	expect(await syncExtension(root, {}, 'fixture')).toEqual({
		entry: join(paths.disabled, 'fixture'),
	});
	await expect(lstat(join(paths.enabled, 'fixture'))).rejects.toMatchObject({
		code: 'ENOENT',
	});
	await expect(lstat(join(paths.web, 'fixture.web.js'))).rejects.toMatchObject({
		code: 'ENOENT',
	});
	await unlinkExtension('fixture');
	await expect(lstat(join(paths.disabled, 'fixture'))).rejects.toMatchObject({
		code: 'ENOENT',
	});
	expect(await readFile(join(source, 'index.ts'), 'utf8')).toContain(
		'export default',
	);
});

it('rejects unsupported manifests before changing the installed link', async () => {
	await symlink(source, join(paths.disabled, 'fixture'), 'junction');
	await writeFile(
		join(source, 'gizmo.json'),
		JSON.stringify({ apiVersion: 9, web: false, capabilities: [] }),
	);
	await expect(syncExtension(root, {}, 'fixture')).rejects.toThrow(
		'Unsupported',
	);
	expect((await lstat(join(paths.disabled, 'fixture'))).isSymbolicLink()).toBe(
		true,
	);
});
