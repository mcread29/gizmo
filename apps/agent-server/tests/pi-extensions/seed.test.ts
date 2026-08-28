import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { seededPiExtensionPaths } from '../../src/pi-extensions/seed';

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

describe('shipped Pi extension seeding', () => {
	it('seeds ask_user into the data dir and returns its path', async () => {
		const dataDir = await mkdtemp(join(tmpdir(), 'gizmo-seed-'));
		directories.push(dataDir);

		const paths = await seededPiExtensionPaths(dataDir);

		// The tool and its web UI ship and seed as a pair.
		expect(paths).toHaveLength(2);
		expect(paths[0]).toContain('ask-user.ts');
		expect(paths[1]).toContain('ask-user.web.js');
		const source = await readFile(paths[0]!, 'utf8');
		expect(source).toContain('ask_user');
		expect(source).toContain('ctx.hasUI');
	});

	it('overwrites a stale seeded file with the shipped source', async () => {
		const dataDir = await mkdtemp(join(tmpdir(), 'gizmo-seed-'));
		directories.push(dataDir);
		const stale = join(dataDir, 'pi-extensions', 'ask-user.ts');
		await mkdir(join(dataDir, 'pi-extensions'), { recursive: true });
		await writeFile(stale, '// an outdated copy');

		await seededPiExtensionPaths(dataDir);

		const source = await readFile(stale, 'utf8');
		expect(source).toContain('ask_user');
	});
});
