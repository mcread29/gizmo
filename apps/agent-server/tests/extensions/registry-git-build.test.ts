import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { win32 } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
	pnpmCommand,
	registryUpdateAvailable,
} from '../../src/extensions/registry-git-build';

const exec = promisify(execFile);
const paths: string[] = [];

afterEach(async () => {
	await Promise.all(
		paths.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

describe('registryUpdateAvailable', () => {
	it('only reports an update when the source HEAD changes', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gizmo-registry-update-'));
		const source = join(root, 'source');
		const clone = join(root, 'clone');
		paths.push(root);

		await git(['init', '-b', 'main', source], root);
		await writeFile(join(source, 'registry.txt'), 'one');
		await commit(source, 'initial');
		await git(['clone', source, clone], root);

		await expect(registryUpdateAvailable(clone)).resolves.toBe(false);

		await writeFile(join(source, 'registry.txt'), 'two');
		await commit(source, 'update');

		await expect(registryUpdateAvailable(clone)).resolves.toBe(true);
	});
});

async function commit(repository: string, message: string) {
	await git(['add', '.'], repository);
	await git(
		[
			'-c',
			'user.name=Gizmo Test',
			'-c',
			'user.email=gizmo@example.test',
			'commit',
			'-m',
			message,
		],
		repository,
	);
}

async function git(args: string[], cwd: string) {
	await exec('git', args, { cwd, windowsHide: true });
}

describe('pnpmCommand', () => {
	const node = join('/opt', 'node', 'bin', 'node');
	const only =
		(...present: string[]) =>
		(path: string) =>
			present.includes(path);

	it('prefers the pnpm shim beside the node the service runs', () => {
		const pnpm = join('/opt', 'node', 'bin', 'pnpm');
		expect(pnpmCommand(node, 'linux', only(pnpm))).toEqual({
			command: pnpm,
			args: [],
		});
	});

	it('falls back to corepack beside node when pnpm was never enabled', () => {
		const corepack = join('/opt', 'node', 'bin', 'corepack');
		expect(pnpmCommand(node, 'linux', only(corepack))).toEqual({
			command: corepack,
			args: ['pnpm'],
		});
	});

	it('leaves PATH resolution as the last resort', () => {
		expect(pnpmCommand(node, 'linux', () => false)).toEqual({
			command: 'pnpm',
			args: [],
		});
	});

	it('names the .cmd shims on Windows', () => {
		const exe = 'C:\\nodejs\\node.exe';
		expect(pnpmCommand(exe, 'win32', () => false).command).toBe('pnpm.cmd');
		const shim = win32.join('C:\\nodejs', 'pnpm.cmd');
		expect(pnpmCommand(exe, 'win32', only(shim)).command).toBe(shim);
	});
});
