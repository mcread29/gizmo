import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	defaultPiRuntimePaths,
	gizmoPiRuntimePaths,
	importPiRuntimeConfig,
	reimportPiAuth,
} from '../../src/config/pi-runtime-config';

const paths: string[] = [];

afterEach(async () => {
	await Promise.all(
		paths.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

describe('Pi runtime configuration', () => {
	it('uses only Gizmo-owned runtime paths', async () => {
		const dataDir = await temporary('gizmo-data-');
		expect(gizmoPiRuntimePaths(dataDir)).toEqual({
			agentDir: dataDir,
			authPath: join(dataDir, 'auth.json'),
			modelsPath: join(dataDir, 'models.json'),
			modelsStorePath: join(dataDir, 'models-store.json'),
		});
	});

	it('uses Pi-owned runtime paths in default Pi mode', async () => {
		const agentDir = await temporary('pi-agent-');
		expect(defaultPiRuntimePaths(agentDir)).toEqual({
			agentDir,
			authPath: join(agentDir, 'auth.json'),
			modelsPath: join(agentDir, 'models.json'),
			modelsStorePath: join(agentDir, 'models-store.json'),
		});
	});

	it('imports missing Pi config without overwriting Gizmo config', async () => {
		const dataDir = await temporary('gizmo-data-');
		const piDir = await temporary('pi-agent-');
		await writeFile(join(piDir, 'auth.json'), '{"openai":"pi"}\n');
		await writeFile(join(piDir, 'settings.json'), '{"theme":"pi"}\n');
		await writeFile(join(piDir, 'models.json'), '{"providers":{}}\n');
		await writeFile(join(dataDir, 'settings.json'), '{"theme":"gizmo"}\n');

		expect(await importPiRuntimeConfig(dataDir, piDir)).toEqual([
			'auth.json',
			'models.json',
		]);
		expect(await readFile(join(dataDir, 'settings.json'), 'utf8')).toBe(
			'{"theme":"gizmo"}\n',
		);
		expect(await readFile(join(dataDir, 'auth.json'), 'utf8')).toBe(
			'{"openai":"pi"}\n',
		);
		if (process.platform !== 'win32') {
			expect((await stat(join(dataDir, 'auth.json'))).mode & 0o777).toBe(0o600);
		}
		expect(await importPiRuntimeConfig(dataDir, piDir)).toEqual([]);
	});

	it('quietly skips an absent Pi directory', async () => {
		const dataDir = await temporary('gizmo-data-');
		expect(
			await importPiRuntimeConfig(dataDir, join(dataDir, 'missing-pi')),
		).toEqual([]);
	});

	it('explicitly re-imports Pi auth without changing other config', async () => {
		const dataDir = await temporary('gizmo-data-');
		const piDir = await temporary('pi-agent-');
		await writeFile(join(dataDir, 'auth.json'), '{"old":true}\n');
		await writeFile(join(dataDir, 'settings.json'), '{"gizmo":true}\n');
		await writeFile(join(piDir, 'auth.json'), '{"new":true}\n');

		await reimportPiAuth(dataDir, piDir);

		expect(await readFile(join(dataDir, 'auth.json'), 'utf8')).toBe(
			'{"new":true}\n',
		);
		expect(await readFile(join(dataDir, 'settings.json'), 'utf8')).toBe(
			'{"gizmo":true}\n',
		);
		if (process.platform !== 'win32') {
			expect((await stat(join(dataDir, 'auth.json'))).mode & 0o777).toBe(0o600);
		}
	});
});

async function temporary(prefix: string) {
	const path = await mkdtemp(join(tmpdir(), prefix));
	paths.push(path);
	await mkdir(path, { recursive: true });
	return path;
}
