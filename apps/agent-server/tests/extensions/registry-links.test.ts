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

const paths = vi.hoisted(() => ({ enabled: '', disabled: '' }));
vi.mock('../../src/extensions/registry-storage', async (original) => ({
	...(await original<typeof import('../../src/extensions/registry-storage')>()),
	extensionsDir: () => paths.enabled,
	disabledExtensionsDir: () => paths.disabled,
}));
let root: string;
let source: string;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'gizmo-links-'));
	paths.enabled = join(root, 'enabled');
	paths.disabled = join(root, 'disabled');
	source = join(root, 'extensions/fixture');
	for (const dir of [paths.disabled, source])
		await mkdir(dir, { recursive: true });
	await writeFile(join(source, 'index.ts'), 'export default () => {};');
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('keeps a disabled link disabled during refresh and removes it on uninstall', async () => {
	await symlink(source, join(paths.disabled, 'fixture'), 'junction');
	expect(await syncExtension(root, {}, 'fixture')).toBe(
		join(paths.disabled, 'fixture'),
	);
	await expect(lstat(join(paths.enabled, 'fixture'))).rejects.toMatchObject({
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

it('rejects an extension without an entry before changing the installed link', async () => {
	await symlink(source, join(paths.disabled, 'fixture'), 'junction');
	await rm(join(source, 'index.ts'));
	await expect(syncExtension(root, {}, 'fixture')).rejects.toMatchObject({
		code: 'ENOENT',
	});
	expect((await lstat(join(paths.disabled, 'fixture'))).isSymbolicLink()).toBe(
		true,
	);
});

it('leaves a single location when a stale entry sits on the other side', async () => {
	await mkdir(join(paths.enabled, 'fixture'), { recursive: true });
	await writeFile(join(paths.enabled, 'fixture', 'index.ts'), 'stale copy');
	await symlink(source, join(paths.disabled, 'fixture'), 'junction');

	expect(await syncExtension(root, {}, 'fixture')).toBe(
		join(paths.disabled, 'fixture'),
	);
	// The stale enabled copy is gone, so the id is disabled exactly once.
	await expect(lstat(join(paths.enabled, 'fixture'))).rejects.toMatchObject({
		code: 'ENOENT',
	});
	expect((await lstat(join(paths.disabled, 'fixture'))).isSymbolicLink()).toBe(
		true,
	);
});
