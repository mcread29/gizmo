import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseExtensionManifest } from '@gizmo/extensions';
import {
	readExtensionManifest,
	validateExtensionId,
} from '../../src/extensions/extension-manifest';

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe('extension manifests', () => {
	it('validates the supported contract and rejects unsupported versions', () => {
		expect(
			parseExtensionManifest({
				apiVersion: 1,
				web: false,
				capabilities: ['tools'],
			}),
		).toEqual({ apiVersion: 1, web: false, capabilities: ['tools'] });
		expect(() =>
			parseExtensionManifest({ apiVersion: 2, web: true, capabilities: [] }),
		).toThrow('Unsupported');
		for (const value of [
			null,
			[],
			{},
			{ apiVersion: 1, web: 'yes', capabilities: [] },
			{ apiVersion: 1, web: true, capabilities: [null] },
		]) {
			expect(() => parseExtensionManifest(value)).toThrow();
		}
	});
	it('allows legacy extensions but reports malformed sidecars', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gizmo-manifest-'));
		roots.push(root);
		expect(await readExtensionManifest(root)).toBeUndefined();
		await writeFile(join(root, 'gizmo.json'), '{broken');
		await expect(readExtensionManifest(root)).rejects.toThrow(
			'Invalid extension manifest',
		);
		expect(await readFile(join(root, 'gizmo.json'), 'utf8')).toBe('{broken');
	});
	it('rejects path traversal before registry filesystem mutations', () => {
		for (const id of [
			'../outside',
			'.',
			'..',
			'C:\\outside',
			'a/b',
			'a\\b',
			'',
		]) {
			expect(() => validateExtensionId(id)).toThrow();
		}
		expect(() => validateExtensionId('search-and-scrape')).not.toThrow();
	});
});
