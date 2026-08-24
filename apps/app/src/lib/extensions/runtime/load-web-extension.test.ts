import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWebExtensions } from './load-web-extension';
import { hostModulesKey } from './host-modules';
import { registerWebExtensions, webExtensions } from '../registry.svelte';

/**
 * jsdom implements neither blob URLs nor dynamic import of them, so the module
 * boundary is stubbed. What is under test here is the contract around it:
 * validation, isolation of a failing bundle, and host-module publication.
 */
beforeEach(() => {
	registerWebExtensions([]);
	// Node/Vitest cannot resolve a real `blob:` object URL through dynamic
	// import, so createObjectURL is stubbed to hand back a `data:` URL
	// carrying the same source instead — a real import that actually
	// evaluates the module, unlike a full mock of `loadWebExtension`.
	vi.stubGlobal('URL', {
		...URL,
		createObjectURL: vi.fn(
			(blob: Blob) =>
				`data:text/javascript;base64,${Buffer.from(
					(blob as unknown as { __source: string }).__source ?? '',
				).toString('base64')}`,
		),
		revokeObjectURL: vi.fn(),
	});
	vi.stubGlobal(
		'Blob',
		class {
			readonly __source: string;
			constructor(parts: string[]) {
				this.__source = parts.join('');
			}
		},
	);
});

describe('loadWebExtensions', () => {
	it('rejects a bundle that exports no extension', async () => {
		vi.doMock('/dev/null', () => ({}));
		const result = await loadWebExtensions([{ id: 'a', code: 'export {}' }]);

		expect(result.extensions).toEqual([]);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]).toContain('Failed to load web extension "a"');
	});

	it('publishes the host modules a plugin bundle needs', async () => {
		await loadWebExtensions([{ id: 'a', code: 'export {}' }]);

		const published = (globalThis as Record<string, unknown>)[
			hostModulesKey
		] as Record<string, unknown> | undefined;
		expect(published?.['svelte']).toBeDefined();
		expect(published?.['svelte/internal/client']).toBeDefined();
	});

	it('publishes the host modules as non-writable, so one plugin cannot poison the runtime seen by another', async () => {
		await loadWebExtensions([{ id: 'a', code: 'export {}' }]);

		const descriptor = Object.getOwnPropertyDescriptor(
			globalThis,
			hostModulesKey,
		);
		expect(descriptor?.writable).toBe(false);
		expect(descriptor?.configurable).toBe(false);
		expect(() => {
			(globalThis as Record<string, unknown>)[hostModulesKey] = {
				poisoned: true,
			};
		}).toThrow();
	});

	it('keeps working bundles when one fails', async () => {
		const result = await loadWebExtensions([
			{ id: 'a', code: 'broken(' },
			{ id: 'b', code: 'broken(' },
		]);

		expect(result.diagnostics).toHaveLength(2);
		expect(result.extensions).toEqual([]);
	});

	it('rejects a bundle that claims a different id than it was served as', async () => {
		const result = await loadWebExtensions([
			{
				id: 'a',
				code: `export const gizmoWebExtension = { id: 'other' };`,
			},
		]);

		expect(result.extensions).toEqual([]);
		expect(result.diagnostics[0]).toContain('declares id "other"');
	});

	it('drops one malformed field instead of failing the whole bundle', async () => {
		const result = await loadWebExtensions([
			{
				id: 'a',
				code: `export const gizmoWebExtension = {
					id: 'a',
					hasProjectStatus: 'yes',
					labels: { foo: 'ok' },
				};`,
			},
		]);

		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0]).toMatchObject({
			id: 'a',
			labels: { foo: 'ok' },
		});
		expect(result.extensions[0]).not.toHaveProperty('hasProjectStatus');
		expect(result.diagnostics[0]).toContain(
			'"hasProjectStatus" is not a boolean',
		);
	});

	it('rejects a labels record with a non-string value', async () => {
		const result = await loadWebExtensions([
			{
				id: 'a',
				code: `export const gizmoWebExtension = { id: 'a', labels: { foo: 1 } };`,
			},
		]);

		expect(result.extensions[0]).not.toHaveProperty('labels');
		expect(result.diagnostics[0]).toContain(
			'"labels" is not a string-to-string record',
		);
	});

	it('rejects a function field given as the wrong type', async () => {
		const result = await loadWebExtensions([
			{
				id: 'a',
				code: `export const gizmoWebExtension = { id: 'a', dialog: 'not-a-component' };`,
			},
		]);

		expect(result.extensions[0]).not.toHaveProperty('dialog');
		expect(result.diagnostics[0]).toContain('"dialog" is not a component');
	});

	it('keeps every field when the bundle is well-formed', async () => {
		const result = await loadWebExtensions([
			{
				id: 'a',
				code: `export const gizmoWebExtension = {
					id: 'a',
					hasProjectStatus: true,
					apiVersion: 2,
					activate: () => ({}),
					iconFor: () => undefined,
				};`,
			},
		]);

		expect(result.diagnostics).toEqual([]);
		expect(result.extensions[0]).toMatchObject({
			id: 'a',
			hasProjectStatus: true,
			apiVersion: 2,
		});
		expect(typeof result.extensions[0]?.activate).toBe('function');
	});
});

describe('registerWebExtensions', () => {
	it('adds loaded extensions alongside the built-in ones', () => {
		registerWebExtensions([{ id: 'third-party' }, { id: 'unity', labels: { ok: 'yes' } }]);

		expect(webExtensions().map(({ id }) => id)).toContain('third-party');
		expect(webExtensions().map(({ id }) => id)).toContain('unity');
		expect(webExtensions().map(({ id }) => id)).toContain('svelte');
	});

	it('never lets a loaded bundle displace a built-in of the same id', () => {
		const impostor = { id: 'svelte', labels: { spoofed: 'yes' } };
		registerWebExtensions([impostor]);

		const svelte = webExtensions().filter(({ id }) => id === 'svelte');
		expect(svelte).toHaveLength(1);
		expect(svelte[0]).not.toBe(impostor);
	});

	it('replaces the previous set rather than accumulating', () => {
		registerWebExtensions([{ id: 'first' }]);
		registerWebExtensions([{ id: 'second' }]);

		const ids = webExtensions().map(({ id }) => id);
		expect(ids).toContain('second');
		expect(ids).not.toContain('first');
	});
});
