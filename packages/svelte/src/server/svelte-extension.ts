import type { GizmoServerExtension } from '@gizmo/extensions';

export const svelteExtension: GizmoServerExtension = {
	id: 'svelte',
	name: 'Svelte',
	profile: (root) => ({
		id: 'svelte',
		name: 'Svelte',
		source: 'extension:svelte',
		base: 'default',
		extensions: [{ id: 'svelte', root }],
		tools: { mode: 'default-plus-extension' },
		prompt: { mode: 'default-plus-extension-fragments' },
	}),
	systemPrompt: `This workspace uses Svelte. Respect its existing Svelte version and conventions. Prefer the project's configured check, test, and build scripts for verification, and do not assume SvelteKit unless its packages or configuration are present.`,
	createTools: () => [],
};
