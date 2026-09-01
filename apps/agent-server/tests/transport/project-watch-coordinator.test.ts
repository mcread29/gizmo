import { describe, expect, it, vi } from 'vitest';
import { ProjectServiceRegistry, type ProjectService } from '@gizmo/extensions';
import type { ExtensionHostService } from '../../src/extensions/extension-host-service';
import { createProjectWatchCoordinator } from '../../src/transport/project-watch-coordinator';

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
		watch: createProjectWatchCoordinator(
			new ProjectServiceRegistry(Object.entries(services)),
			host,
			emit,
		),
	};
}

describe('createProjectWatchCoordinator', () => {
	it('refreshes status without re-watching a service already watched', async () => {
		const git = service();
		const { watch } = coordinator({ git });
		await watch.watch('s', '/a', 'git');
		await watch.watch('s', '/a', 'git');
		expect(git.watchedPaths).toEqual(['/a']);
	});

	it('re-points every watched service when the project path changes', async () => {
		const git = service();
		const tests = service();
		const { watch, stopExtensionWatch, host } = coordinator({ git, tests });
		await watch.watch('s', '/a', 'git');
		await watch.watch('s', '/a', 'tests');
		await watch.watch('s', '/b', 'git');
		expect(stopExtensionWatch).toHaveBeenCalledTimes(1);
		expect(host.watch).toHaveBeenCalledTimes(2);
		expect(git.watchedPaths).toEqual(['/a', '/b']);
		// Not requested for /b, but its /a watch must not be left behind.
		expect(tests.watchedPaths).toEqual(['/a', '/b']);
	});

	it('throws for an unknown extension', () => {
		const { watch } = coordinator({});
		expect(() => watch.watch('s', '/a', 'nope')).toThrow(/No project service/);
	});
});
