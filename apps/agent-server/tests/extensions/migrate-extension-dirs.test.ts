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
import { migrateExtensionDirs } from '../../src/extensions/migrate-extension-dirs';
import {
	disabledExtensionsDir,
	extensionsDir,
} from '../../src/extensions/registry-storage';

const paths = vi.hoisted(() => ({ data: '' }));
vi.mock('../../src/sessions/session-repository', async (original) => ({
	...(await original<typeof import('../../src/sessions/session-repository')>()),
	defaultDataDir: () => paths.data,
}));

let root: string;
let oldEnabled: string;
let oldDisabled: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'gizmo-migrate-dirs-'));
	paths.data = join(root, 'data');
	oldEnabled = join(root, 'pi', 'extensions');
	oldDisabled = join(root, 'pi', 'extensions-disabled');
	for (const dir of [oldEnabled, oldDisabled])
		await mkdir(dir, { recursive: true });
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

async function seedClone(id: string) {
	const clone = join(paths.data, 'registries', 'gizmo-registry');
	const dir = join(clone, 'extensions', id);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(clone, 'gizmo.registry.json'),
		JSON.stringify({ extensions: [{ id }] }),
	);
	await writeFile(join(dir, 'index.ts'), 'export default () => {};');
	await writeFile(
		join(paths.data, 'registries', 'installed.json'),
		JSON.stringify({ linked: [id] }),
	);
	return join(clone, 'extensions', id);
}

const options = () => ({ oldEnabled, oldDisabled });

it('re-links a registry extension into the Gizmo directory and drops the old link', async () => {
	const source = await seedClone('reg-ext');
	await symlink(source, join(oldEnabled, 'reg-ext'), 'junction');

	await migrateExtensionDirs(options());

	expect((await lstat(join(extensionsDir(), 'reg-ext'))).isSymbolicLink()).toBe(
		true,
	);
	await expect(lstat(join(oldEnabled, 'reg-ext'))).rejects.toMatchObject({
		code: 'ENOENT',
	});
});

it('keeps a disabled registry link disabled across the move', async () => {
	const source = await seedClone('reg-off');
	await symlink(source, join(oldDisabled, 'reg-off'), 'junction');

	await migrateExtensionDirs(options());

	expect(
		(await lstat(join(disabledExtensionsDir(), 'reg-off'))).isSymbolicLink(),
	).toBe(true);
	await expect(lstat(join(extensionsDir(), 'reg-off'))).rejects.toMatchObject({
		code: 'ENOENT',
	});
	await expect(lstat(join(oldDisabled, 'reg-off'))).rejects.toMatchObject({
		code: 'ENOENT',
	});
});

it('imports a hand-written global as a copy and leaves the original alone', async () => {
	await writeFile(join(oldEnabled, 'notes.ts'), 'export default () => {};');

	await migrateExtensionDirs(options());

	expect(await readFile(join(extensionsDir(), 'notes.ts'), 'utf8')).toContain(
		'export default',
	);
	expect(
		(await lstat(join(extensionsDir(), 'notes.ts'))).isSymbolicLink(),
	).toBe(false);
	// The Pi CLI still owns ~/.pi, so the original stays put.
	expect(await readFile(join(oldEnabled, 'notes.ts'), 'utf8')).toContain(
		'export default',
	);
});

it('prefers the enabled copy when the old dirs duplicate an id', async () => {
	await writeFile(join(oldEnabled, 'dup.ts'), 'enabled copy');
	await writeFile(join(oldDisabled, 'dup.ts'), 'disabled copy');

	await migrateExtensionDirs(options());

	expect(await readFile(join(extensionsDir(), 'dup.ts'), 'utf8')).toBe(
		'enabled copy',
	);
	await expect(
		lstat(join(disabledExtensionsDir(), 'dup.ts')),
	).rejects.toMatchObject({ code: 'ENOENT' });
});

it('never overwrites what a previous run already migrated', async () => {
	await writeFile(join(oldEnabled, 'notes.ts'), 'first import');

	await migrateExtensionDirs(options());
	await writeFile(join(oldEnabled, 'notes.ts'), 'changed upstream');
	await writeFile(join(extensionsDir(), 'notes.ts'), 'edited in gizmo');
	await migrateExtensionDirs(options());

	expect(await readFile(join(extensionsDir(), 'notes.ts'), 'utf8')).toBe(
		'edited in gizmo',
	);
});
