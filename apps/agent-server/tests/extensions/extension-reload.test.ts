import { describe, expect, it, vi } from 'vitest';
import { ProjectServiceRegistry, type ProjectService } from '@gizmo/extensions';
import {
	configureExtensionReload,
	notifyExtensionsChanged,
	reloadExtensions,
} from '../../src/extensions/extension-reload';

const service = (log: string[], name: string): ProjectService => ({
	getStatus: async () => name,
	watchStatus: async () => name,
	openProject: async () => undefined,
	revertFile: async () => undefined,
	dispose: () => log.push(`dispose ${name}`),
});

describe('ProjectServiceRegistry.replace', () => {
	it('disposes every previous service and reports replaced and removed ids', () => {
		const log: string[] = [];
		const registry = new ProjectServiceRegistry([
			['unity', service(log, 'unity-1')],
			['git', service(log, 'git-1')],
		]);
		const outcome = registry.replace([['unity', service(log, 'unity-2')]]);
		expect(outcome).toEqual({ replaced: ['unity'], removed: ['git'] });
		expect(log).toEqual(['dispose unity-1', 'dispose git-1']);
		expect(registry.ids).toEqual(['unity']);
		expect(registry.serviceFor('git')).toBeUndefined();
	});
});

describe('reloadExtensions', () => {
	it('queues edits received after the current reload has started', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const rebuild = vi.fn(async () => {
			if (rebuild.mock.calls.length === 1) await gate;
			return [];
		});
		const broadcast = vi.fn();
		configureExtensionReload({
			rebuildWebBundles: rebuild,
			refreshProjectServices: () => {},
			reloadSessions: async () => ({ reloaded: [], pending: [] }),
			broadcast,
		});
		const first = reloadExtensions({ rebuild: ['git'] });
		await vi.waitFor(() => expect(rebuild).toHaveBeenCalledTimes(1));
		const second = reloadExtensions({ rebuild: ['unity'] });
		expect(second).not.toBe(first);
		release();
		await Promise.all([first, second]);
		expect(rebuild.mock.calls).toEqual([
			[['git'], false],
			[['unity'], false],
		]);
		expect(broadcast).toHaveBeenCalledTimes(2);
	});

	it('rebuilds, refreshes services, reloads sessions, and broadcasts once', async () => {
		const calls: string[] = [];
		const broadcast = vi.fn();
		configureExtensionReload({
			rebuildWebBundles: async (ids, force) => {
				calls.push(`rebuild ${ids ? ids.join(',') : force ? 'all' : 'stale'}`);
				return ['warn'];
			},
			refreshProjectServices: () => {
				calls.push('services');
			},
			reloadSessions: async () => {
				calls.push('sessions');
				return { reloaded: ['a'], pending: ['b'] };
			},
			broadcast,
		});

		const [first, second] = await Promise.all([
			reloadExtensions({ rebuild: true }),
			reloadExtensions({ rebuild: true }),
		]);
		// Concurrent callers share one pass.
		expect(first).toBe(second);
		expect(calls).toEqual(['rebuild all', 'services', 'sessions']);
		expect(first).toMatchObject({
			reloadedSessions: ['a'],
			pendingSessions: ['b'],
			diagnostics: ['warn'],
		});
		expect(broadcast).toHaveBeenCalledTimes(1);

		await reloadExtensions({ rebuild: ['git'] });
		expect(calls.at(-3)).toBe('rebuild git');
		await reloadExtensions();
		expect(calls.at(-3)).toBe('rebuild stale');
		calls.length = 0;
		await reloadExtensions({ rebuild: false });
		expect(calls).toEqual(['services', 'sessions']);
		calls.length = 0;
		await reloadExtensions({ rebuild: [] });
		expect(calls).toEqual(['services', 'sessions']);
	});

	it('keeps going when a hook fails and reports it as a diagnostic', async () => {
		const broadcast = vi.fn();
		configureExtensionReload({
			rebuildWebBundles: async () => {
				throw new Error('vite exploded');
			},
			refreshProjectServices: () => {
				throw new Error('no services');
			},
			reloadSessions: async () => ({ reloaded: [], pending: [] }),
			broadcast,
		});
		const result = await reloadExtensions();
		expect(result.diagnostics).toEqual([
			'Web bundle rebuild failed: vite exploded',
			'Project services did not refresh: no services',
		]);
		expect(broadcast).toHaveBeenCalledWith(result);
	});

	it('notifies clients of a bundle-only change without reloading sessions', () => {
		const broadcast = vi.fn();
		const reloadSessions = vi.fn();
		configureExtensionReload({
			refreshProjectServices: () => {},
			reloadSessions,
			broadcast,
		});
		notifyExtensionsChanged(['rebuilt']);
		expect(reloadSessions).not.toHaveBeenCalled();
		expect(broadcast).toHaveBeenCalledWith(
			expect.objectContaining({
				diagnostics: ['rebuilt'],
				pendingSessions: [],
			}),
		);
	});
});
