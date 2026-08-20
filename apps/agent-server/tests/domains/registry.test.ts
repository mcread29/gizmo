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
			'svelte',
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
		const unity = await activateDomains(
			{ workspacePath, confirm: async () => true },
			'unity',
		);
		const svelte = await activateDomains(
			{ workspacePath, confirm: async () => true },
			'svelte',
		);

		expect(unity.domains.map(({ id }) => id)).toEqual(['unity']);
		expect(unity.tools.some(({ name }) => name === 'unity_status')).toBe(true);
		expect(svelte.domains.map(({ id }) => id)).toEqual(['svelte']);
	});

	it('uses Pi defaults for the generic domain', async () => {
		const active = await activateDomains(
			{ workspacePath: await workspace(), confirm: async () => false },
			'generic',
		);
		expect(active).toEqual({ domains: [], tools: [] });
	});
});

async function workspace(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), 'gizmo-domain-'));
	directories.push(path);
	return path;
}
