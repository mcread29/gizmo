import { expect, it, vi } from 'vitest';
import { refreshExtensionPaths } from '../../src/sessions/extension-reload-paths';

const dependencies = vi.hoisted(() => ({
	overrides: vi.fn(async () => ({ disabled: ['off'], enabled: ['on'] })),
	paths: vi.fn(
		async (_disabled: ReadonlySet<string>, _enabled: ReadonlySet<string>) => [
			'new-extension',
		],
	),
}));
vi.mock('../../src/projects/project-catalog', () => ({
	ProjectCatalog: class {
		piExtensionOverridesFor = dependencies.overrides;
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
	expect(dependencies.overrides).toHaveBeenCalledWith('/workspace');
	// Both directions reach the loader: what the workspace switches off, and
	// what it switches on despite the global state.
	expect(dependencies.paths).toHaveBeenCalledWith(
		new Set(['off']),
		new Set(['on']),
	);
});
