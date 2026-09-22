import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SettingsField } from '@gizmo/extension-api';
import { beforeEach, describe, expect, it } from 'vitest';
import { ExtensionSettingsStore } from '../../src/extensions/extension-settings-store';

const fields: SettingsField[] = [
	{ kind: 'text', key: 'name', label: 'Name' },
	{ kind: 'number', key: 'port', label: 'Port', min: 1, max: 10 },
	{ kind: 'boolean', key: 'loud', label: 'Loud' },
	{
		kind: 'select',
		key: 'mode',
		label: 'Mode',
		options: [
			{ value: 'fast', label: 'Fast' },
			{ value: 'slow', label: 'Slow' },
		],
	},
	{ kind: 'model', key: 'model', label: 'Model', thinking: true },
];

let file = '';
let store: ExtensionSettingsStore;

beforeEach(async () => {
	file = join(
		await mkdtemp(join(tmpdir(), 'gizmo-settings-')),
		'extension-settings.json',
	);
	store = new ExtensionSettingsStore(file);
});

describe('ExtensionSettingsStore', () => {
	it('reads an empty store before anything is written', async () => {
		expect(await store.get('demo')).toEqual({});
	});

	it('merges values across writes and clears with null', async () => {
		await store.set('demo', { name: 'one', loud: true }, fields);
		const merged = await store.set('demo', { name: 'two' }, fields);
		expect(merged).toEqual({ name: 'two', loud: true });
		expect(await store.set('demo', { loud: null }, fields)).toEqual({
			name: 'two',
		});
		const stored: unknown = JSON.parse(await readFile(file, 'utf8'));
		expect(stored).toEqual({
			version: 1,
			extensions: { demo: { name: 'two' } },
		});
	});

	it('keeps extensions apart and clears one of them', async () => {
		await store.set('a', { loud: true }, fields);
		await store.set('b', { loud: false }, fields);
		await store.clear('a');
		expect(await store.get('a')).toEqual({});
		expect(await store.get('b')).toEqual({ loud: false });
	});

	it('rejects keys the extension never declared', async () => {
		await expect(store.set('demo', { nope: 1 }, fields)).rejects.toThrow(
			/no setting: nope/,
		);
	});

	it('checks each kind against its declared field', async () => {
		await expect(store.set('demo', { name: 1 }, fields)).rejects.toThrow(
			/a string/,
		);
		await expect(store.set('demo', { port: 99 }, fields)).rejects.toThrow(
			/at most 10/,
		);
		await expect(store.set('demo', { port: 'x' }, fields)).rejects.toThrow(
			/a number/,
		);
		await expect(store.set('demo', { loud: 'yes' }, fields)).rejects.toThrow(
			/true or false/,
		);
		await expect(store.set('demo', { mode: 'other' }, fields)).rejects.toThrow(
			/one of fast, slow/,
		);
		await expect(
			store.set('demo', { model: { id: 'x' } }, fields),
		).rejects.toThrow(/a model/);
	});

	it('stores a model value with its thinking level', async () => {
		expect(
			await store.set(
				'demo',
				{ model: { provider: 'anthropic', id: 'opus', thinkingLevel: 'high' } },
				fields,
			),
		).toEqual({
			model: { provider: 'anthropic', id: 'opus', thinkingLevel: 'high' },
		});
	});

	it('refuses a thinking level on a field that offers none', async () => {
		await expect(
			store.set(
				'demo',
				{ model: { provider: 'a', id: 'b', thinkingLevel: 'high' } },
				[{ kind: 'model', key: 'model', label: 'Model' }],
			),
		).rejects.toThrow(/without a thinking level/);
	});

	it('reads a corrupt file as empty and repairs it on the next write', async () => {
		await writeFile(file, '{ not json');
		expect(await store.get('demo')).toEqual({});
		await store.set('demo', { loud: true }, fields);
		expect(await store.get('demo')).toEqual({ loud: true });
	});

	it('ignores extension entries that are not objects', async () => {
		await writeFile(
			file,
			JSON.stringify({
				version: 1,
				extensions: { demo: 7, ok: { loud: true } },
			}),
		);
		expect(await store.get('demo')).toEqual({});
		expect(await store.get('ok')).toEqual({ loud: true });
	});

	it('does not lose a concurrent write', async () => {
		await Promise.all([
			store.set('demo', { name: 'one' }, fields),
			store.set('demo', { loud: true }, fields),
		]);
		expect(await store.get('demo')).toEqual({ name: 'one', loud: true });
	});
});
