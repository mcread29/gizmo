import { describe, expect, it, vi } from 'vitest';
import {
	ProjectServiceRegistry,
	type ProjectService,
} from '@gizmo/extension-api';
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
	it('queues a reload requested after the current one has started', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const refresh = vi.fn(async () => {
			if (refresh.mock.calls.length === 1) await gate;
		});
		const broadcast = vi.fn();
		configureExtensionReload({
			refreshProjectServices: refresh,
			reloadSessions: async () => ({ reloaded: [], pending: [] }),
			broadcast,
			uiChanged: () => {},
		});
		const first = reloadExtensions();
		await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
		const second = reloadExtensions();
		expect(second).not.toBe(first);
		release();
		await Promise.all([first, second]);
		expect(refresh).toHaveBeenCalledTimes(2);
		expect(broadcast).toHaveBeenCalledTimes(2);
	});

	it('refreshes services, reloads sessions, and broadcasts once', async () => {
		const calls: string[] = [];
		const broadcast = vi.fn();
		configureExtensionReload({
			refreshProjectServices: () => {
				calls.push('services');
			},
			reloadSessions: async () => {
				calls.push('sessions');
				return { reloaded: ['a'], pending: ['b'] };
			},
			broadcast,
			uiChanged: () => {},
		});

		const [first, second] = await Promise.all([
			reloadExtensions(),
			reloadExtensions(),
		]);
		// Concurrent callers share one pass.
		expect(first).toBe(second);
		expect(calls).toEqual(['services', 'sessions']);
		expect(first).toMatchObject({
			reloadedSessions: ['a'],
			pendingSessions: ['b'],
			diagnostics: [],
		});
		expect(broadcast).toHaveBeenCalledTimes(1);
	});

	it('keeps going when a hook fails and reports it as a diagnostic', async () => {
		const broadcast = vi.fn();
		configureExtensionReload({
			refreshProjectServices: () => {
				throw new Error('no services');
			},
			reloadSessions: async () => ({ reloaded: [], pending: [] }),
			broadcast,
			uiChanged: () => {},
		});
		const result = await reloadExtensions();
		expect(result.diagnostics).toEqual([
			'Project services did not refresh: no services',
		]);
		expect(broadcast).toHaveBeenCalledWith(result);
	});

	it('notifies clients of a catalog change without reloading sessions', () => {
		const broadcast = vi.fn();
		const reloadSessions = vi.fn();
		configureExtensionReload({
			refreshProjectServices: () => {},
			reloadSessions,
			broadcast,
			uiChanged: () => {},
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
