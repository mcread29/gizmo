import { describe, expect, it, vi } from 'vitest';
import { ProjectServiceRegistry, type ProjectService } from './project-service';

function stubService(overrides: Partial<ProjectService> = {}): ProjectService {
	return {
		getStatus: () => Promise.resolve({ marker: 'status' }),
		watchStatus: () => Promise.resolve({ marker: 'watching' }),
		openProject: () => Promise.resolve({ marker: 'opened' }),
		revertFile: () => Promise.resolve(),
		dispose: () => {},
		...overrides,
	};
}

describe('ProjectServiceRegistry', () => {
	it('routes each lookup directly to the extension service it names', () => {
		const registry = new ProjectServiceRegistry([
			['unity', stubService()],
			['unreal', stubService()],
		]);

		expect(registry.ids).toEqual(['unity', 'unreal']);
		expect(registry.serviceFor('unreal')).toBeDefined();
		expect(registry.serviceFor('godot')).toBeUndefined();
	});

	it('disposes every service even when one throws', () => {
		const unityDispose = vi.fn();
		const unrealDispose = vi.fn();
		const registry = new ProjectServiceRegistry([
			['unity', stubService({ dispose: unityDispose })],
			['unreal', stubService({ dispose: unrealDispose })],
		]);

		registry.dispose();

		expect(unityDispose).toHaveBeenCalledOnce();
		expect(unrealDispose).toHaveBeenCalledOnce();
	});
});
