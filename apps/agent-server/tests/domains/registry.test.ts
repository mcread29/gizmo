import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { activateDomains } from '../../src/domains/registry';

const directories: string[] = [];

afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

describe('workspace domain registry', () => {
	it('activates Svelte without exposing Unity tools', async () => {
		const workspacePath = await workspace();
		await writeFile(
			join(workspacePath, 'package.json'),
			JSON.stringify({ devDependencies: { svelte: '^5.0.0' } }),
		);
		const active = await activateDomains(
			{ workspacePath, confirm: async () => false },
			[{ id: 'svelte', root: '.' }],
		);

		expect(active.domains.map(({ id }) => id)).toEqual(['svelte']);
		expect(active.tools).toEqual([]);
		expect(active.systemPrompt).toContain('This workspace uses Svelte');
		expect(active.systemPrompt).not.toContain('unity_status');
	});

	it('composes domains for a Unity project with a Svelte toolchain', async () => {
		const workspacePath = await workspace();
		await mkdir(join(workspacePath, 'ProjectSettings'));
		await writeFile(
			join(workspacePath, 'package.json'),
			JSON.stringify({ dependencies: { svelte: '5.0.0' } }),
		);
		const active = await activateDomains(
			{ workspacePath, confirm: async () => true },
			[
				{ id: 'unity', root: '.' },
				{ id: 'svelte', root: '.' },
			],
		);

		expect(active.domains.map(({ id }) => id)).toEqual(['unity', 'svelte']);
		expect(active.tools.some(({ name }) => name === 'unity_status')).toBe(true);
	});

	it('uses Pi defaults for the generic domain', async () => {
		const active = await activateDomains(
			{ workspacePath: await workspace(), confirm: async () => false },
			[],
		);
		expect(active).toEqual({ domains: [], tools: [] });
	});
});

async function workspace(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), 'gizmo-domain-'));
	directories.push(path);
	return path;
}
