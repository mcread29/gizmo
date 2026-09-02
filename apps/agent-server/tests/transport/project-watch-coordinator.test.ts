import { describe, expect, it, vi } from 'vitest';
import { ProjectServiceRegistry, type ProjectService } from '@gizmo/extensions';
import type { ExtensionHostService } from '../../src/extensions/extension-host-service';
import { ProjectWatchCoordinator } from '../../src/transport/project-watch-coordinator';

function service(): ProjectService & { watchedPaths: string[] } {
	const watchedPaths: string[] = [];
	return {
		watchedPaths,
		getStatus: (path) => Promise.resolve({ path }),
		watchStatus: (path) => {
			watchedPaths.push(path);
			return Promise.resolve({ path });
		},
		openProject: () => Promise.resolve(undefined),
		revertFile: () => Promise.resolve(),
		dispose: () => {},
	};
}

function coordinator(services: Record<string, ProjectService>) {
	const stopExtensionWatch = vi.fn();
	const host = {
		watch: vi.fn(() => stopExtensionWatch),
	} as unknown as ExtensionHostService;
	const emit = { status: vi.fn(), extensions: vi.fn() };
	return {
		host,
		emit,
		stopExtensionWatch,
		watch: new ProjectWatchCoordinator(
			new ProjectServiceRegistry(Object.entries(services)),
			host,
			emit,
		),
	};
}

describe('ProjectWatchCoordinator', () => {
	it('refreshes status without re-watching a service already watched', async () => {
		const git = service();
		const { watch } = coordinator({ git });
		await watch.watch('s', '/a', 'git');
		await watch.watch('s', '/a', 'git');
		expect(git.watchedPaths).toEqual(['/a']);
	});

	it('watches the same project from two connections without re-watching', async () => {
		const git = service();
		const { watch } = coordinator({ git });
		await watch.watch('s1', '/a', 'git');
		await watch.watch('s2', '/a', 'git');
		expect(git.watchedPaths).toEqual(['/a']);
	});

	it('re-points a service when the watched path changes', async () => {
		const git = service();
		const tests = service();
		const { watch, stopExtensionWatch, host } = coordinator({ git, tests });
		await watch.watch('s', '/a', 'git');
		await watch.watch('s', '/a', 'tests');
		await watch.watch('s', '/b', 'git');
		expect(host.watch).toHaveBeenCalledTimes(2);
		expect(git.watchedPaths).toEqual(['/a', '/b']);
		// A service watches one path at a time, so tests stays on /a — its
		// events keep broadcasting and every tab filters by its own selection.
		expect(tests.watchedPaths).toEqual(['/a']);
		// /a is not abandoned: tests still watches it, so the shared
		// extension-host watch for the path stays alive too.
		expect(stopExtensionWatch).not.toHaveBeenCalled();
		await watch.watch('s', '/b', 'tests');
		// Only now does /a lose its last service and its host watch.
		expect(stopExtensionWatch).toHaveBeenCalledTimes(1);
	});

	it('throws for an unknown extension', async () => {
		const { watch } = coordinator({});
		await expect(watch.watch('s', '/a', 'nope')).rejects.toThrow(
			/No project service/,
		);
	});
});
