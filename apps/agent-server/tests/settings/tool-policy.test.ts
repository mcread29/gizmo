import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { builtInAgentTools, seededToolPolicy } from '@gizmo/protocol';
import {
	readToolPolicy,
	writeGlobalToolPolicy,
	writeProjectToolPolicy,
} from '../../src/settings/tool-policy';

const directories: string[] = [];

async function makeAgentDir(settings?: object): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'gizmo-tool-policy-'));
	directories.push(dir);
	if (settings) {
		await writeFile(
			join(dir, 'settings.json'),
			JSON.stringify(settings, null, 2),
			'utf8',
		);
	}
	return dir;
}

async function makeWorkspace(settings?: object): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'gizmo-tool-workspace-'));
	directories.push(dir);
	if (settings) {
		await mkdir(join(dir, '.pi'), { recursive: true });
		await writeFile(
			join(dir, '.pi', 'settings.json'),
			JSON.stringify(settings, null, 2),
			'utf8',
		);
	}
	return dir;
}

afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe('tool policy', () => {
	it('seeds the global setting when absent', async () => {
		const agentDir = await makeAgentDir();

		const policy = await readToolPolicy({ agentDir });

		expect(policy.global).toEqual([...seededToolPolicy]);
		const stored = JSON.parse(
			await readFile(join(agentDir, 'settings.json'), 'utf8'),
		);
		expect(stored.defaultTools).toEqual([...seededToolPolicy]);
	});

	it('seeds into an existing global file while preserving other settings', async () => {
		const agentDir = await makeAgentDir({ lastChangelogVersion: '1' });

		await readToolPolicy({ agentDir });

		const stored = JSON.parse(
			await readFile(join(agentDir, 'settings.json'), 'utf8'),
		);
		// Only an absent key is seeded; other settings survive untouched.
		expect(stored.defaultTools).toEqual([...seededToolPolicy]);
		expect(stored.lastChangelogVersion).toBe('1');
	});

	it('keeps an existing global policy untouched', async () => {
		const agentDir = await makeAgentDir({
			defaultTools: ['read', 'bash'],
		});

		const policy = await readToolPolicy({ agentDir });

		expect(policy.global).toEqual(['read', 'bash']);
		expect(policy.effective).toEqual(['read', 'bash']);
	});

	it('reports Pi defaults when the global policy was cleared entirely', async () => {
		const agentDir = await makeAgentDir({ defaultTools: [] });
		await writeGlobalToolPolicy(agentDir, [...builtInAgentTools]);

		const policy = await readToolPolicy({ agentDir });

		expect(policy.global).toEqual([...builtInAgentTools]);
		expect(policy.effective).toEqual([...builtInAgentTools]);
	});

	it('applies a trusted project override over the global policy', async () => {
		const agentDir = await makeAgentDir();
		const workspace = await makeWorkspace({
			defaultTools: ['read', 'bash'],
		});

		const policy = await readToolPolicy({
			cwd: workspace,
			agentDir,
			projectTrusted: true,
		});

		expect(policy.global).toEqual([...seededToolPolicy]);
		expect(policy.project).toEqual(['read', 'bash']);
		expect(policy.effective).toEqual(['read', 'bash']);
		expect(policy.projectApplied).toBe(true);
	});

	it('ignores an untrusted project override', async () => {
		const agentDir = await makeAgentDir();
		const workspace = await makeWorkspace({
			defaultTools: ['bash'],
		});

		const policy = await readToolPolicy({
			cwd: workspace,
			agentDir,
			projectTrusted: false,
		});

		expect(policy.project).toEqual(['bash']);
		expect(policy.effective).toEqual([...seededToolPolicy]);
		expect(policy.projectApplied).toBe(false);
	});

	it('treats project settings as applied when trust is not resolved (Pi default)', async () => {
		const agentDir = await makeAgentDir();
		const workspace = await makeWorkspace({
			defaultTools: ['read', 'grep'],
		});

		const policy = await readToolPolicy({ cwd: workspace, agentDir });

		expect(policy.effective).toEqual(['read', 'grep']);
		expect(policy.projectApplied).toBe(true);
	});

	it('clears a project override and removes an otherwise-empty file', async () => {
		const agentDir = await makeAgentDir();
		const workspace = await makeWorkspace({
			defaultTools: ['bash'],
		});

		await writeProjectToolPolicy(workspace, null);

		const path = join(workspace, '.pi', 'settings.json');
		expect(existsSync(path)).toBe(false);
		const policy = await readToolPolicy({ cwd: workspace, agentDir });
		expect(policy.project).toBeNull();
		expect(policy.effective).toEqual([...seededToolPolicy]);
	});

	it('clears a project override while keeping sibling project settings', async () => {
		const agentDir = await makeAgentDir();
		const workspace = await makeWorkspace({
			defaultTools: ['bash'],
			theme: 'dark',
		});

		await writeProjectToolPolicy(workspace, null);

		const stored = JSON.parse(
			await readFile(join(workspace, '.pi', 'settings.json'), 'utf8'),
		);
		expect(stored).toEqual({ theme: 'dark' });
	});

	it('writes a project override alongside sibling project settings', async () => {
		const agentDir = await makeAgentDir();
		const workspace = await makeWorkspace({ theme: 'dark' });

		await writeProjectToolPolicy(workspace, ['read', 'write']);

		const stored = JSON.parse(
			await readFile(join(workspace, '.pi', 'settings.json'), 'utf8'),
		);
		expect(stored).toEqual({ theme: 'dark', defaultTools: ['read', 'write'] });
	});

	it('ignores unknown tool names when writing', async () => {
		const agentDir = await makeAgentDir();

		await writeGlobalToolPolicy(agentDir, ['read', 'not-a-tool', 'bash']);

		const policy = await readToolPolicy({ agentDir });
		expect(policy.global).toEqual(['read', 'bash']);
	});
});
