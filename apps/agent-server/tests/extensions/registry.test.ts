import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { gizmoExtension as unityExtension } from '@gizmo/unity/server';
import { activateExtensions, registerExtensions } from '../../src/extensions/registry';

const directories: string[] = [];

beforeAll(() => {
	registerExtensions([unityExtension]);
});

afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

describe('extension registry', () => {
	it('activates Svelte without exposing Unity tools', async () => {
		const workspacePath = await workspace();
		await writeFile(
			join(workspacePath, 'package.json'),
			JSON.stringify({ devDependencies: { svelte: '^5.0.0' } }),
		);
		const active = await activateExtensions(
			{ workspacePath, confirm: async () => false },
			[{ id: 'svelte', root: '.' }],
		);

		expect(active.extensions.map(({ id }) => id)).toEqual(['svelte']);
		expect(active.tools).toEqual([]);
		expect(active.systemPrompt).toContain('This workspace uses Svelte');
		expect(active.systemPrompt).not.toContain('unity_status');
	});

	it('composes extensions for a Unity project with a Svelte toolchain', async () => {
		const workspacePath = await workspace();
		await mkdir(join(workspacePath, 'ProjectSettings'));
		await writeFile(
			join(workspacePath, 'package.json'),
			JSON.stringify({ dependencies: { svelte: '5.0.0' } }),
		);
		const active = await activateExtensions(
			{ workspacePath, confirm: async () => true },
			[
				{ id: 'unity', root: '.' },
				{ id: 'svelte', root: '.' },
			],
		);

		expect(active.extensions.map(({ id }) => id)).toEqual(['unity', 'svelte']);
		expect(active.tools.some(({ name }) => name === 'unity_status')).toBe(true);
	});

	it('uses Pi defaults when nothing is active', async () => {
		const active = await activateExtensions(
			{ workspacePath: await workspace(), confirm: async () => false },
			[],
		);
		expect(active).toEqual({ extensions: [], tools: [] });
	});
});

async function workspace(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), 'gizmo-registry-'));
	directories.push(path);
	return path;
}
