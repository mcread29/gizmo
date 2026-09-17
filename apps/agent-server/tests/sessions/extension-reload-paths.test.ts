import { expect, it, vi } from 'vitest';
import { refreshExtensionPaths } from '../../src/sessions/extension-reload-paths';

const dependencies = vi.hoisted(() => ({
	disabled: vi.fn(async () => ['off']),
	paths: vi.fn(async (_disabled: ReadonlySet<string>) => ['new-extension']),
}));
vi.mock('../../src/projects/project-catalog', () => ({
	ProjectCatalog: class {
		disabledPiExtensionsFor = dependencies.disabled;
	},
}));
vi.mock('../../src/resources/pi-global-resources', () => ({
	enabledPiExtensionPaths: dependencies.paths,
}));

it('refreshes the retained Pi loader array with current workspace enablement', async () => {
	const paths = ['builtin', 'removed-extension'];
	const retained = paths;
	await refreshExtensionPaths(paths, ['builtin'], '/workspace');
	expect(retained).toEqual(['builtin', 'new-extension']);
	expect(dependencies.disabled).toHaveBeenCalledWith('/workspace');
	expect(dependencies.paths).toHaveBeenCalledWith(new Set(['off']));
});
