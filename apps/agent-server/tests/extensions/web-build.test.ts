import {
	mkdtemp,
	readFile,
	readdir,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildExtensionWebBundle } from '../../src/extensions/web-build';

const child = vi.hoisted(() => ({ fail: false }));
vi.mock('node:child_process', () => ({
	execFile: (
		_exe: string,
		args: string[],
		_options: unknown,
		callback: (error: Error | null, stdout: string, stderr: string) => void,
	) => {
		void import('node:fs/promises').then(async ({ writeFile }) => {
			await writeFile(args.at(-1)!, 'new bundle');
			callback(child.fail ? new Error('build failed') : null, '', '');
		});
	},
}));

const roots: string[] = [];
afterEach(async () => {
	child.fail = false;
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'gizmo-atomic-build-'));
	roots.push(root);
	return { root, out: join(root, 'fixture.web.js') };
}

describe('web bundle replacement', () => {
	it('keeps the last successful bundle on build failure and cleans temporary files', async () => {
		const { root, out } = await fixture();
		await writeFile(out, 'working bundle');
		child.fail = true;
		await expect(buildExtensionWebBundle(root, out)).rejects.toThrow(
			'build failed',
		);
		expect(await readFile(out, 'utf8')).toBe('working bundle');
		expect(await readdir(root)).toEqual(['fixture.web.js']);
	});
	it('replaces a legacy symlink without writing through it', async () => {
		const { root, out } = await fixture();
		const source = join(root, 'registry.web.js');
		await writeFile(source, 'registry bundle');
		await symlink(source, out, 'file');
		await buildExtensionWebBundle(root, out);
		expect(await readFile(out, 'utf8')).toBe('new bundle');
		expect(await readFile(source, 'utf8')).toBe('registry bundle');
	});
});
