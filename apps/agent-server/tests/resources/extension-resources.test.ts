import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GizmoServerExtension } from '@gizmo/extensions';
import {
	extensionResourceRoots,
	linkedExtensionResourceRoots,
	packageResourceRoots,
} from '../../src/resources/extension-resources';

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'gizmo-extension-pkg-'));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

async function dir(...parts: string[]): Promise<string> {
	const path = join(root, ...parts);
	await mkdir(path, { recursive: true });
	return path;
}

async function manifest(contents: unknown): Promise<void> {
	await writeFile(join(root, 'package.json'), JSON.stringify(contents), 'utf8');
}

function extension(packageRoot?: string): GizmoServerExtension {
	return {
		id: 'example',
		name: 'Example',
		...(packageRoot ? { packageRoot } : {}),
	};
}

describe('packageResourceRoots', () => {
	it('uses the conventional directories when there is no pi manifest', async () => {
		const skills = await dir('skills');
		const prompts = await dir('prompts');

		await expect(packageResourceRoots(root)).resolves.toEqual({
			skills: [skills],
			prompts: [prompts],
		});
	});

	it('prefers the directories a pi manifest declares', async () => {
		await dir('skills');
		const declared = await dir('agent', 'my-skills');
		await manifest({ name: 'example', pi: { skills: ['./agent/my-skills'] } });

		await expect(packageResourceRoots(root)).resolves.toEqual({
			skills: [declared],
			prompts: [],
		});
	});

	it('accepts a bare string as well as an array', async () => {
		const declared = await dir('s');
		await manifest({ pi: { skills: './s' } });

		await expect(packageResourceRoots(root)).resolves.toMatchObject({
			skills: [declared],
		});
	});

	it('falls back to the convention when pi declares neither key', async () => {
		const skills = await dir('skills');
		await manifest({ name: 'example', pi: { themes: ['./themes'] } });

		await expect(packageResourceRoots(root)).resolves.toMatchObject({
			skills: [skills],
		});
	});

	it('drops declared directories the package does not ship', async () => {
		await manifest({ pi: { skills: ['./nope'] } });

		await expect(packageResourceRoots(root)).resolves.toEqual({
			skills: [],
			prompts: [],
		});
	});

	it('refuses directories that escape the package root', async () => {
		await manifest({ pi: { skills: ['../..', '/etc'] } });

		await expect(packageResourceRoots(root)).resolves.toEqual({
			skills: [],
			prompts: [],
		});
	});
});

describe('extensionResourceRoots', () => {
	it('discovers resources directly from linked directory extensions', async () => {
		const skills = await dir('skills');
		const file = join(root, 'single-file.ts');
		await writeFile(file, 'export default function () {}');

		await expect(linkedExtensionResourceRoots([root, file])).resolves.toEqual({
			skills: [skills],
			prompts: [],
		});
	});

	it('collects roots across extensions and ignores those without a package', async () => {
		const skills = await dir('skills');

		await expect(
			extensionResourceRoots([extension(root), extension()]),
		).resolves.toEqual({ skills: [skills], prompts: [] });
	});

	it('contributes nothing when no extension declares a package root', async () => {
		await expect(extensionResourceRoots([extension()])).resolves.toEqual({
			skills: [],
			prompts: [],
		});
	});
});
