import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWebExtensions } from './load-web-extension';
import { hostModulesKey } from './host-modules';
import { registerWebExtensions, webExtensions } from '../registry.svelte';

/**
 * jsdom implements neither blob URLs nor dynamic import of them, so the module
 * boundary is stubbed. What is under test here is the contract around it:
 * validation, isolation of a failing bundle, and host-module publication.
 */
const modules = new Map<string, unknown>();

beforeEach(() => {
	modules.clear();
	registerWebExtensions([]);
	let next = 0;
	vi.stubGlobal('URL', {
		...URL,
		createObjectURL: vi.fn((blob: Blob) => {
			const url = `blob:test/${++next}`;
			modules.set(url, blob);
			return url;
		}),
		revokeObjectURL: vi.fn((url: string) => modules.delete(url)),
	});
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

	it('keeps working bundles when one fails', async () => {
		const result = await loadWebExtensions([
			{ id: 'a', code: 'broken(' },
			{ id: 'b', code: 'broken(' },
		]);

		expect(result.diagnostics).toHaveLength(2);
		expect(result.extensions).toEqual([]);
	});
});

describe('registerWebExtensions', () => {
	it('adds loaded extensions alongside the built-in ones', () => {
		registerWebExtensions([{ id: 'third-party' }]);

		expect(webExtensions().map(({ id }) => id)).toContain('third-party');
		expect(webExtensions().map(({ id }) => id)).toContain('unity');
	});

	it('never lets a loaded bundle displace a built-in of the same id', () => {
		const impostor = { id: 'unity', labels: { spoofed: 'yes' } };
		registerWebExtensions([impostor]);

		const unity = webExtensions().filter(({ id }) => id === 'unity');
		expect(unity).toHaveLength(1);
		expect(unity[0]).not.toBe(impostor);
	});

	it('replaces the previous set rather than accumulating', () => {
		registerWebExtensions([{ id: 'first' }]);
		registerWebExtensions([{ id: 'second' }]);

		const ids = webExtensions().map(({ id }) => id);
		expect(ids).toContain('second');
		expect(ids).not.toContain('first');
	});
});
